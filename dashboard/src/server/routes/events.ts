import type { FastifyPluginAsync } from 'fastify';

export const eventsRoute: FastifyPluginAsync = async (app) => {
  app.get('/events', async (req, reply) => {
    const { watcher } = app.appState;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    watcher.addClient(reply.raw);

    req.raw.on('close', () => {
      watcher.removeClient(reply.raw);
    });

    // Prevent Fastify from sending a response — we handle it manually
    reply.hijack();
  });
};
