#!/usr/bin/env node

import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sessionsRoute } from './routes/sessions.js';
import { tasksRoute } from './routes/tasks.js';
import { configRoute } from './routes/config.js';
import { summaryRoute } from './routes/summary.js';
import { projectRoute } from './routes/project.js';
import { eventsRoute } from './routes/events.js';
import { Watcher } from './services/watcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(): { project?: string; port: number; open: boolean } {
  const args = process.argv.slice(2);
  let project: string | undefined;
  let port = Number(process.env.PORT) || 3001;
  let open = false;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--project' || args[i] === '-p') && args[i + 1]) {
      project = path.resolve(args[++i]);
    } else if (args[i] === '--port' && args[i + 1]) {
      port = Number(args[++i]);
    } else if (args[i] === '--open' || args[i] === '-o') {
      open = true;
    }
  }

  if (!project && process.env.CLAUDEBOT_PROJECT_DIR) {
    project = path.resolve(process.env.CLAUDEBOT_PROJECT_DIR);
  }

  return { project, port, open };
}

export interface AppState {
  projectPath: string | null;
  watcher: Watcher;
}

async function main() {
  const { project, port, open } = parseArgs();

  const app = Fastify({ logger: true });

  const watcher = new Watcher();
  const state: AppState = {
    projectPath: project ?? null,
    watcher,
  };

  // Decorate fastify with app state
  app.decorate('appState', state);

  // CORS for dev mode
  if (process.env.NODE_ENV !== 'production') {
    await app.register(cors, { origin: true });
  }

  // Register API routes
  await app.register(sessionsRoute, { prefix: '/api' });
  await app.register(tasksRoute, { prefix: '/api' });
  await app.register(configRoute, { prefix: '/api' });
  await app.register(summaryRoute, { prefix: '/api' });
  await app.register(projectRoute, { prefix: '/api' });
  await app.register(eventsRoute, { prefix: '/api' });

  // Production: serve static client files
  if (process.env.NODE_ENV === 'production') {
    const clientDir = path.join(__dirname, '..', 'client');
    await app.register(fastifyStatic, { root: clientDir });
    app.setNotFoundHandler((_req, reply) => {
      reply.sendFile('index.html');
    });
  }

  // Start watcher if project path is set
  if (state.projectPath) {
    watcher.start(state.projectPath);
  }

  await app.listen({ port, host: 'localhost' });
  console.log(`Dashboard server running at http://localhost:${port}`);

  if (state.projectPath) {
    console.log(`Watching project: ${state.projectPath}`);
  } else {
    console.log('No project path set. Use the web UI to select a project.');
  }

  if (open) {
    const { exec } = await import('node:child_process');
    exec(`start http://localhost:${port}`);
  }
}

// Fastify type augmentation
declare module 'fastify' {
  interface FastifyInstance {
    appState: AppState;
  }
}

main().catch((err) => {
  console.error('Failed to start dashboard server:', err);
  process.exit(1);
});
