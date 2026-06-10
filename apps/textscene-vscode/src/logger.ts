/** VSCode LogOutputChannel adapter for @textscene/core logging. */

import * as vscode from 'vscode';
import { setLogAdapter, type LogAdapter } from '@textscene/core/logger';

class VscodeLogAdapter implements LogAdapter {
  constructor(private channel: vscode.LogOutputChannel) {}

  trace(message: string, ...args: unknown[]): void {
    this.channel.trace(message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.channel.debug(message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.channel.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.channel.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.channel.error(message, ...args);
  }
}

let logChannel: vscode.LogOutputChannel | null = null;

export function initLogger(name: string): void {
  logChannel = vscode.window.createOutputChannel(name, { log: true });
  setLogAdapter(new VscodeLogAdapter(logChannel));
}

export function show(): void {
  logChannel?.show(true);
}

export function getChannel(): vscode.LogOutputChannel | null {
  return logChannel;
}

export function dispose(): void {
  logChannel?.dispose();
  logChannel = null;
  setLogAdapter(null);
}
