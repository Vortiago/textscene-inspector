/**
 * Webview `log` and `resourceNeeded` messages onto the host output channel.
 *
 * `logger.ts` opens the channel with `{ log: true }`, so its real shape is a
 * `LogOutputChannel` with one method per level — an output-channel mock
 * carrying only `appendLine` makes every line below unreachable.
 */
import { describe, expect, it, beforeEach, afterEach, type Mock } from 'vitest';
import { relayMissingResource, relayWebviewLog } from './hostLogRelay';
import { getChannel, initLogger, dispose as disposeLogger } from './logger';

type ChannelSpies = Record<
  'trace' | 'debug' | 'info' | 'warn' | 'error' | 'show',
  Mock
>;

function channel(): ChannelSpies {
  return getChannel() as unknown as ChannelSpies;
}

beforeEach(() => {
  initLogger('TextScene Inspector (test)');
});

afterEach(() => {
  disposeLogger();
});

describe('relayWebviewLog', () => {
  const LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const;

  it.each(LEVELS)('routes a %s line to the channel method of that name', (level) => {
    relayWebviewLog(level, 'scene parsed', []);

    expect(channel()[level]).toHaveBeenCalledWith('scene parsed');
    for (const other of LEVELS.filter((l) => l !== level)) {
      expect(channel()[other]).not.toHaveBeenCalled();
    }
  });

  it('falls back to info for a level outside the protocol', () => {
    relayWebviewLog('verbose', 'scene parsed', []);

    expect(channel().info).toHaveBeenCalledWith('scene parsed');
  });

  it('appends args to the message, serialising objects as JSON', () => {
    relayWebviewLog('info', 'loaded', [{ path: 'res://icon.png' }, 3, 'Sprite2D', null]);

    expect(channel().info).toHaveBeenCalledWith(
      'loaded {"path":"res://icon.png"} 3 Sprite2D null'
    );
  });

  it('falls back to String() for an arg JSON cannot serialise', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    relayWebviewLog('warn', 'cycle', [circular]);

    expect(channel().warn).toHaveBeenCalledWith('cycle [object Object]');
  });

  it('is a no-op before the logger is initialised', () => {
    disposeLogger();

    expect(() => relayWebviewLog('info', 'dropped', [])).not.toThrow();
  });
});

describe('relayMissingResource', () => {
  const MISSING = {
    path: 'res://icon.png',
    type: 'Texture2D',
    referencedBy: 'Sprite2D',
    error: 'File not found',
  };

  it('warns the path, the referencing node and the error, then reveals the channel', () => {
    relayMissingResource(MISSING);

    expect(channel().warn).toHaveBeenNthCalledWith(
      1,
      'Missing resource: res://icon.png (Texture2D)'
    );
    expect(channel().warn).toHaveBeenNthCalledWith(2, '  Referenced by node: Sprite2D');
    expect(channel().warn).toHaveBeenNthCalledWith(3, '  Error: File not found');
    expect(channel().show).toHaveBeenCalledWith(true);
  });

  it('is a no-op before the logger is initialised', () => {
    disposeLogger();

    expect(() => relayMissingResource(MISSING)).not.toThrow();
  });
});
