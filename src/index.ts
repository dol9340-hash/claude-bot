#!/usr/bin/env node

/**
 * ClaudeBot — Conversation-driven development orchestrator.
 *
 * Launches the web dashboard (Fastify + React).
 * Usage: npm start [-- --project <path> --port <number> --open]
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.resolve(__dirname, '..', 'dashboard');

// Forward all CLI args to the dashboard server
const args = process.argv.slice(2);

// Check if dashboard is built
const distServer = path.join(dashboardDir, 'dist', 'server', 'index.js');

if (fs.existsSync(distServer)) {
  // Production mode — run built server
  const child = spawn('node', [distServer, ...args], {
    cwd: dashboardDir,
    stdio: 'inherit',
  });
  child.on('exit', (code) => process.exit(code ?? 0));
} else {
  // Dev mode — run via tsx
  console.log('Starting ClaudeBot Dashboard in dev mode...');
  const serverEntry = path.join(dashboardDir, 'src', 'server', 'index.ts');
  const child = spawn('npx', ['tsx', serverEntry, ...args], {
    cwd: dashboardDir,
    stdio: 'inherit',
    shell: true,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}
