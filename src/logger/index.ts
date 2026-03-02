export interface Logger {
  debug(obj: unknown, msg?: string): void;
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  fatal(obj: unknown, msg?: string): void;
  level: string;
}

/** Simple console-based logger. */
function log(level: string, obj: unknown, msg?: string) {
  const ts = new Date().toLocaleTimeString();
  if (typeof obj === 'string') {
    console.error(`[${ts}] ${level}: ${obj}`);
  } else {
    console.error(`[${ts}] ${level}: ${msg ?? ''} ${JSON.stringify(obj)}`);
  }
}

export function createLogger(level: string = 'info'): Logger {
  const levels = ['debug', 'info', 'warn', 'error'];
  const minLevel = levels.indexOf(level);

  const noop = () => {};

  return {
    debug: minLevel <= 0 ? (obj: unknown, msg?: string) => log('DEBUG', obj, msg) : noop,
    info: minLevel <= 1 ? (obj: unknown, msg?: string) => log('INFO', obj, msg) : noop,
    warn: minLevel <= 2 ? (obj: unknown, msg?: string) => log('WARN', obj, msg) : noop,
    error: minLevel <= 3 ? (obj: unknown, msg?: string) => log('ERROR', obj, msg) : noop,
    fatal: (obj: unknown, msg?: string) => log('FATAL', obj, msg),
    level,
  };
}
