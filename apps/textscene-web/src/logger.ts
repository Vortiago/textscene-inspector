/** Browser console logging adapter for web previewer. */

import { setLogAdapter, type LogAdapter } from '@textscene/core';

class ConsoleLogAdapter implements LogAdapter {
  trace(message: string, ...args: unknown[]): void {
    console.debug(message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    console.debug(message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    console.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args);
  }
}

export function initLogger(): void {
  setLogAdapter(new ConsoleLogAdapter());
}
