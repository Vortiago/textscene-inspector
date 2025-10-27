/** Core logging system with pluggable output adapters. */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface LogAdapter {
  trace(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

let adapter: LogAdapter | null = null;

export function setLogAdapter(newAdapter: LogAdapter | null): void {
  adapter = newAdapter;
}

export function trace(message: string, ...args: unknown[]): void {
  adapter?.trace(message, ...args);
}

export function debug(message: string, ...args: unknown[]): void {
  adapter?.debug(message, ...args);
}

export function info(message: string, ...args: unknown[]): void {
  adapter?.info(message, ...args);
}

export function warn(message: string, ...args: unknown[]): void {
  adapter?.warn(message, ...args);
}

export function error(message: string, ...args: unknown[]): void {
  adapter?.error(message, ...args);
}
