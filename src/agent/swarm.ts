import type { SwarmConfig } from '../types.js';

/**
 * Default swarm agent definitions for the Manager/Developer/QA pattern.
 * Uses the SDK's native `agents` option - no custom IPC needed.
 */
export function getDefaultSwarmConfig(): SwarmConfig {
  return {
    enabled: false,
    mainAgent: 'manager',
    agents: {
      manager: {
        description:
          'Project manager that breaks down complex tasks into subtasks ' +
          'and delegates to developer and qa agents.',
        prompt: `You are a senior project manager. Your job is to:
1. Analyze the given task/objective
2. Break it into concrete, actionable subtasks
3. Delegate coding work to the "developer" agent using the Task tool
4. Delegate testing/review to the "qa" agent using the Task tool
5. If QA finds issues, send feedback back to the developer
6. Cap revision cycles at 3 to prevent infinite loops
7. Synthesize results into a final summary`,
        tools: ['Read', 'Grep', 'Glob', 'Task'],
        model: 'opus',
      },
      developer: {
        description:
          'Software developer that implements code changes, writes features, ' +
          'fixes bugs, and refactors existing code.',
        prompt: `You are a senior software developer. Your job is to:
1. Understand the coding task given to you
2. Read relevant files to understand the codebase
3. Implement the requested changes with high quality
4. Follow existing code patterns and conventions
5. Handle edge cases and errors properly`,
        tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
        model: 'sonnet',
      },
      qa: {
        description:
          'QA specialist that reviews code, runs tests, identifies bugs, ' +
          'and validates implementation quality. Has no write access.',
        prompt: `You are a QA engineer and code reviewer. Your job is to:
1. Review code changes for correctness, security, and quality
2. Run existing tests if a test command exists
3. Identify bugs, edge cases, and potential issues
4. Provide clear, actionable feedback
5. Confirm approval if everything passes`,
        tools: ['Read', 'Grep', 'Glob', 'Bash'],
        model: 'sonnet',
      },
    },
  };
}
