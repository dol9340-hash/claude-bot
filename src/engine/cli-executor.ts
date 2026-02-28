import { spawn } from 'node:child_process';
import type { Logger } from 'pino';
import type { Task, TaskResult, ClaudeBotConfig } from '../types.js';
import type { IExecutor, ExecutorCallbacks } from './types.js';
import { createAbortController } from '../utils/abort.js';

/**
 * CLI Executor - Fallback engine using `claude -p --output-format stream-json`.
 * Works with Max subscription billing (no API Key required).
 * Trade-offs: less reliable than SDK, no native subagent support, estimated cost only.
 */
export class CliExecutor implements IExecutor {
  readonly engineType = 'cli' as const;

  async execute(
    task: Task,
    config: ClaudeBotConfig,
    logger: Logger,
    callbacks?: ExecutorCallbacks,
  ): Promise<TaskResult> {
    const { controller, cleanup } = createAbortController(config.taskTimeoutMs);
    const startTime = Date.now();

    const fullPrompt = config.systemPromptPrefix
      ? `${config.systemPromptPrefix}\n\n${task.prompt}`
      : task.prompt;

    const args = [
      '-p', fullPrompt,
      '--output-format', 'stream-json',
      '--verbose',
    ];

    if (config.model) {
      args.push('--model', config.model);
    }
    if (task.maxTurns ?? config.maxTurnsPerTask) {
      args.push('--max-turns', String(task.maxTurns ?? config.maxTurnsPerTask));
    }
    if (config.permissionMode === 'bypassPermissions') {
      args.push('--permission-mode', 'bypassPermissions');
    }

    logger.info({ taskLine: task.line, prompt: task.prompt }, 'Executing task via CLI engine');

    return new Promise<TaskResult>((resolve) => {
      const child = spawn('claude', args, {
        cwd: task.cwd ?? config.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Prevent TTY hang: close stdin immediately
      child.stdin.end();

      let stdout = '';
      let stderr = '';
      let sessionId = '';
      let costUsd = -1;
      let resultText = '';
      const errors: string[] = [];

      child.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;

        // Parse newline-delimited JSON stream
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const msg = JSON.parse(line);

            if (msg.type === 'system' && msg.subtype === 'init') {
              sessionId = msg.session_id ?? '';
            }

            if (msg.type === 'result') {
              sessionId = msg.session_id ?? sessionId;
              costUsd = msg.total_cost_usd ?? -1;

              if (msg.subtype === 'success') {
                resultText = msg.result ?? '';
              } else {
                resultText = `Task failed: ${msg.subtype}`;
                if (Array.isArray(msg.errors)) {
                  errors.push(...msg.errors);
                }
              }
            }

            callbacks?.onProgress?.(line);
          } catch {
            // Not valid JSON, skip (could be ANSI or partial output)
          }
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      // Handle abort/timeout
      const onAbort = () => {
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
        }, 5000);
      };
      controller.signal.addEventListener('abort', onAbort, { once: true });

      child.on('close', (code) => {
        cleanup();
        controller.signal.removeEventListener('abort', onAbort);
        const durationMs = Date.now() - startTime;

        if (controller.signal.aborted) {
          resolve({
            task,
            success: false,
            result: 'Task timed out',
            costUsd: costUsd === -1 ? 0 : costUsd,
            durationMs,
            sessionId,
            errors: ['Task exceeded timeout'],
          });
          return;
        }

        if (stderr) {
          logger.debug({ stderr: stderr.substring(0, 500) }, 'CLI stderr output');
        }

        const success = code === 0 && errors.length === 0 && resultText !== '';
        callbacks?.onCost?.(costUsd === -1 ? 0 : costUsd, sessionId);

        resolve({
          task,
          success,
          result: resultText || (code !== 0 ? `CLI exited with code ${code}` : ''),
          costUsd: costUsd === -1 ? 0 : costUsd,
          durationMs,
          sessionId,
          errors: code !== 0 && errors.length === 0
            ? [`CLI exited with code ${code}`]
            : errors,
        });
      });

      child.on('error', (err) => {
        cleanup();
        resolve({
          task,
          success: false,
          result: `Failed to spawn CLI: ${err.message}`,
          costUsd: 0,
          durationMs: Date.now() - startTime,
          sessionId: '',
          errors: [err.message],
        });
      });
    });
  }
}
