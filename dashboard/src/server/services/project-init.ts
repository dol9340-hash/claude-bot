/**
 * project-init.ts
 * Initialises a new (or existing unconfigured) project directory with
 * ClaudeBot template files: claudebot.config.json, AGENTS.md, docs/, .claudebot/
 */
import fs from 'node:fs';
import path from 'node:path';

export interface ProjectInitOptions {
  projectPath: string;
  projectName?: string;
  model?: string;
}

export interface ProjectInitServiceResult {
  success: boolean;
  path: string;
  filesCreated: string[];
  error?: string;
}

// ─── Default Templates ────────────────────────────────────────────────────────

function defaultConfig(model: string) {
  return {
    engine: 'sdk',
    model,
    permissionMode: 'acceptEdits',
    maxBudgetPerTaskUsd: 2.0,
    maxTotalBudgetUsd: 20.0,
    taskTimeoutMs: 600000,
    maxRetries: 2,
    stopOnFailure: false,
    logLevel: 'info',
    autoOnboarding: false,
  };
}

function agentsMdTemplate(projectName: string): string {
  return `# ${projectName} – Agent Team

## Roles

### orchestrator
- Coordinates all agents
- Breaks down epics into subtasks and delegates to developers
- Synthesises results and reports progress

### developer
- Implements features, bug fixes, and refactors
- Writes and updates tests
- Operates with permissionMode: acceptEdits

### reviewer
- Reviews code quality and correctness
- Checks for bugs, security issues, and best practices
- Provides structured, actionable feedback

## Workflow

1. **Onboarding** — Orchestrator gathers project context and requirements
2. **Prediction** — Orchestrator analyses the codebase and previews expected output
3. **Documentation** — Orchestrator generates PRD, TechSpec, and Tasks docs in \`docs/\`
4. **Development** — Developers implement tasks in parallel; reviewer validates
5. **Review** — Reviewer checks final output against goals; orchestrator reports

## Notes

- All agents use the Claude Agent SDK (engine: sdk)
- Budget limits are enforced per-task and globally (see claudebot.config.json)
- Extend this file to customise agent behaviour, tools, or personas
`;
}

function prdTemplate(projectName: string): string {
  return `# ${projectName} – Product Requirements Document

## Overview
<!-- Describe the project purpose and target users -->

## Goals
- [ ] Goal 1
- [ ] Goal 2

## Non-Goals
<!-- What is explicitly out of scope -->

## User Stories
<!-- As a <role>, I want <feature>, so that <benefit> -->

## Success Metrics
<!-- How will you measure success? -->
`;
}

// ─── Main Init Function ───────────────────────────────────────────────────────

export function initProject(options: ProjectInitOptions): ProjectInitServiceResult {
  const { projectPath, projectName, model = 'claude-sonnet-4-6' } = options;
  const name = projectName?.trim() || path.basename(projectPath);
  const filesCreated: string[] = [];

  try {
    // 1. Create project root if it does not exist
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }

    if (!fs.statSync(projectPath).isDirectory()) {
      return { success: false, path: projectPath, filesCreated, error: 'Path is not a directory' };
    }

    // 2. claudebot.config.json
    const configPath = path.join(projectPath, 'claudebot.config.json');
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig(model), null, 2) + '\n', 'utf-8');
      filesCreated.push('claudebot.config.json');
    }

    // 3. AGENTS.md
    const agentsPath = path.join(projectPath, 'AGENTS.md');
    if (!fs.existsSync(agentsPath)) {
      fs.writeFileSync(agentsPath, agentsMdTemplate(name), 'utf-8');
      filesCreated.push('AGENTS.md');
    }

    // 4. docs/ directory with a starter PRD
    const docsDir = path.join(projectPath, 'docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
      filesCreated.push('docs/');
    }
    const prdPath = path.join(docsDir, 'PRD.md');
    if (!fs.existsSync(prdPath)) {
      fs.writeFileSync(prdPath, prdTemplate(name), 'utf-8');
      filesCreated.push('docs/PRD.md');
    }

    // 5. .claudebot/ runtime directory
    const runtimeDir = path.join(projectPath, '.claudebot');
    if (!fs.existsSync(runtimeDir)) {
      fs.mkdirSync(runtimeDir, { recursive: true });
      filesCreated.push('.claudebot/');
    }

    return { success: true, path: projectPath, filesCreated };
  } catch (err) {
    return {
      success: false,
      path: projectPath,
      filesCreated,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
