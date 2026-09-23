/**
 * Webview `log` messages onto the extension's output channel. The webview posts a
 * level, a message and args, and the channel takes one string per level.
 */

import type { MissingResource } from '@textscene/core/parser';
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

  const fullMessage = formattedArgs.length > 0
    ? `${message} ${formattedArgs.join(' ')}`
    : message;

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

/**
 * A resource the scene needs and the host could not supply. It is logged and the
 * channel is raised, because without it the preview only looks wrong.
 */
export function relayMissingResource(resource: MissingResource): void {
  const channel = logger.getChannel();
  if (channel) {
    channel.warn(`Missing resource: ${resource.path} (${resource.type})`);
    channel.warn(`  Referenced by node: ${resource.referencedBy}`);
    channel.warn(`  Error: ${resource.error}`);

    logger.show();
  }
}
