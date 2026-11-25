import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { isLoadTimingOn, recordLoadTiming } from './loadTiming.mjs';
import { LOAD_TIMING_PREFIX } from './pageRecorder.mjs';

/** A context with the two members `recordLoadTiming` uses, and the init scripts it was given. */
function fakeContext() {
  const context = new EventEmitter();
  context.initScripts = [];
  context.addInitScript = async (script, arg) => context.initScripts.push({ script, arg });
  return context;
}

function logFrom(page, event) {
  page.emit('console', { text: () => LOAD_TIMING_PREFIX + JSON.stringify(event) });
}

describe('isLoadTimingOn', () => {
  it('is on only for TEXTSCENE_LOAD_TIMING=1', () => {
    expect(isLoadTimingOn({ TEXTSCENE_LOAD_TIMING: '1' })).toBe(true);
    expect(isLoadTimingOn({ TEXTSCENE_LOAD_TIMING: '0' })).toBe(false);
    expect(isLoadTimingOn({})).toBe(false);
  });
});

describe('recordLoadTiming', () => {
  it('installs the page recorder with the prefix it reads', async () => {
    const context = fakeContext();
    await recordLoadTiming(context, () => {});
    expect(context.initScripts).toHaveLength(1);
    expect(context.initScripts[0].arg).toBe(LOAD_TIMING_PREFIX);
  });

  it('prints each recorded event, then the summary when the page closes', async () => {
    const context = fakeContext();
    const lines = [];
    await recordLoadTiming(context, (line) => lines.push(line));
    const page = new EventEmitter();
    context.emit('page', page);
    logFrom(page, { at: 20, kind: 'navigate', search: '?fixture=lit.tscn' });
    page.emit('console', { text: () => 'an app log line' });
    page.emit('close');
    expect(lines).toEqual([
      '[load-timing] 20 ms navigate ?fixture=lit.tscn',
      '[load-timing] ?fixture=lit.tscn: canvas inserted at no time, 0 programs drawn, ' +
        'the slowest first draw 0 ms, 0 main-thread tasks over 1000 ms, the longest 0 ms',
    ]);
  });
});
