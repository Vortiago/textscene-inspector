/**
 * Webview `log` messages onto the extension's output channel.
 *
 * The webview posts a level, a message and already-serialised-ish args; the
 * channel takes one string per level, so the two have to be reconciled.
 */

import type { MissingResource } from '@textscene/core/parser';
import * as logger from './logger';

/** Relay one webview log line to the output channel, if there is one. */
export function relayWebviewLog(level: string, message: string, args: unknown[]): void {
  const channel = logger.getChannel();
  if (!channel) {
    return;
  }

  // Format args for display
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
 * A resource the scene needs and the host could not supply. Surfaced on the
 * channel AND raised, because the preview looks merely wrong without it.
 */
export function relayMissingResource(resource: MissingResource): void {
  const channel = logger.getChannel();
  if (channel) {
    channel.warn(`Missing resource: ${resource.path} (${resource.type})`);
    channel.warn(`  Referenced by node: ${resource.referencedBy}`);
    channel.warn(`  Error: ${resource.error}`);

    // Show the output channel so user can see the error
    logger.show();
  }
}
