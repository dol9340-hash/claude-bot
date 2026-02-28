process.on('uncaughtException', (e) => console.error('UNCAUGHT:', e));
process.on('unhandledRejection', (e) => console.error('UNHANDLED:', e));

console.error("[1] start");

async function main() {
  console.error("[2] loading config");
  const { loadConfig } = await import('./src/config.js');
  const config = await loadConfig({ engine: 'cli', logLevel: 'debug' });
  console.error("[3] config ok, engine:", config.engine);

  const { createLogger } = await import('./src/logger/index.js');
  const logger = createLogger(config.logLevel);
  console.error("[4] logger ok");

  const { ClaudeBot } = await import('./src/bot.js');
  const bot = new ClaudeBot(config, logger);
  console.error("[5] bot created, running...");

  const result = await bot.run();
  console.error("[6] done:", result.completed, "completed,", result.failed, "failed");
  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error("[ERROR]", e);
  process.exit(2);
});
