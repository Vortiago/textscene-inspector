/**
 * Webview `log` messages onto the extension's output channel. The webview posts a
 * level, a message and args, and the channel takes one string per level.
 */

import * as logger from './logger';

/** Relay one webview log line to the output channel, if there is one. */
export function relayWebviewLog(level: string, message: string, args: unknown[]): void {
  const channel = logger.getChannel();
  if (!channel) {
    return;
  }

  const formattedArgs = args.map((arg) => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  });

  const fullMessage = formattedArgs.length > 0 ? `${message} ${formattedArgs.join(' ')}` : message;

  switch (level) {
    case 'trace':
      channel.trace(fullMessage);
      break;
    case 'debug':
      channel.debug(fullMessage);
      break;
    case 'info':
      channel.info(fullMessage);
      break;
    case 'warn':
      channel.warn(fullMessage);
      break;
    case 'error':
      channel.error(fullMessage);
      break;
    default:
      channel.info(fullMessage);
  }
}
