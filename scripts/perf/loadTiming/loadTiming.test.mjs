import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { recordLoadTimingWhenOn } from './loadTiming.mjs';
import { LOAD_TIMING_PREFIX } from './pageRecorder.mjs';

const ON = { TEXTSCENE_LOAD_TIMING: '1' };

function fakeContext() {
  const context = new EventEmitter();
  context.addInitScript = vi.fn(async () => {});
  return context;
}

function logFrom(page, event) {
  page.emit('console', { text: () => LOAD_TIMING_PREFIX + JSON.stringify(event) });
}

describe('recordLoadTimingWhenOn', () => {
  it('installs the page recorder with the prefix it reads when the switch is on', async () => {
    const context = fakeContext();
    await recordLoadTimingWhenOn(context, ON, () => {});
    expect(context.addInitScript).toHaveBeenCalledWith(expect.any(Function), LOAD_TIMING_PREFIX);
  });

  it('installs nothing unless the switch is 1', async () => {
    const context = fakeContext();
    await recordLoadTimingWhenOn(context, {}, () => {});
    await recordLoadTimingWhenOn(context, { TEXTSCENE_LOAD_TIMING: '0' }, () => {});
    expect(context.addInitScript).not.toHaveBeenCalled();
  });

  it('prints each recorded event and skips the app log lines', async () => {
    const context = fakeContext();
    const lines = [];
    await recordLoadTimingWhenOn(context, ON, (line) => lines.push(line));
    const page = new EventEmitter();
    context.emit('page', page);
    logFrom(page, { at: 20, kind: 'navigate', search: '?fixture=lit.tscn' });
    page.emit('console', { text: () => 'an app log line' });
    expect(lines).toEqual(['[load-timing] 20 ms navigate ?fixture=lit.tscn']);
  });

  it('prints the summary when the page closes', async () => {
    const context = fakeContext();
    const lines = [];
    await recordLoadTimingWhenOn(context, ON, (line) => lines.push(line));
    const page = new EventEmitter();
    context.emit('page', page);
    logFrom(page, { at: 20, kind: 'navigate', search: '?fixture=lit.tscn' });
    page.emit('close');
    expect(lines.at(-1)).toMatch(/^\[load-timing\] \?fixture=lit\.tscn: canvas inserted at no time/);
  });
});
