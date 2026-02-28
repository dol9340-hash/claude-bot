import type { EngineType } from '../types.js';
import type { IExecutor } from './types.js';
import { SdkExecutor } from './sdk-executor.js';
import { CliExecutor } from './cli-executor.js';

/**
 * Creates the appropriate executor based on the engine type.
 * - 'sdk': Uses @anthropic-ai/claude-agent-sdk (requires API Key)
 * - 'cli': Uses `claude -p` CLI (works with Max subscription)
 */
export function createExecutor(engine: EngineType): IExecutor {
  switch (engine) {
    case 'sdk':
      return new SdkExecutor();
    case 'cli':
      return new CliExecutor();
    default:
      throw new Error(`Unknown engine type: ${engine}`);
  }
}
