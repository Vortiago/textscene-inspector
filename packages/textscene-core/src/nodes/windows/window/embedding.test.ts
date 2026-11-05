/**
 * The order an embedder draws its windows in and the one that has focus, as registration leaves them
 * (`viewport.cpp:308-341`): checked against the measured four-window capture, where C draws the
 * focused border and A, always on top, draws last.
 */
import { describe, expect, it } from 'vitest';
import { rootEmbedsSubwindows, subwindowStack, type StackedWindow } from './embedding';

const window = (name: string, flags: Partial<StackedWindow> = {}): StackedWindow => ({
  name,
  unfocusable: false,
  alwaysOnTop: false,
  exclusive: false,
  parent: null,
  ...flags,
});

describe('subwindowStack', () => {
  it('draws in registration order and focuses the last window that takes focus', () => {
    const stack = subwindowStack([window('A'), window('B'), window('C', { unfocusable: true })]);
    expect(stack.order.map((w) => w.name)).toEqual(['A', 'B', 'C']);
    expect(stack.focused?.name).toBe('B');
  });

  it('moves an always-on-top window above the rest, keeping each group in order (`:269-289`)', () => {
    const stack = subwindowStack([
      window('A', { alwaysOnTop: true }),
      window('B', { unfocusable: true }),
      window('C'),
      window('D', { unfocusable: true }),
    ]);
    expect(stack.order.map((w) => w.name)).toEqual(['B', 'C', 'D', 'A']);
    expect(stack.focused?.name).toBe('C');
  });

  it('lifts an exclusive child of an always-on-top window with it', () => {
    const parent = window('P', { alwaysOnTop: true });
    const stack = subwindowStack([parent, window('Q'), window('E', { exclusive: true, parent })]);
    expect(stack.order.map((w) => w.name)).toEqual(['Q', 'P', 'E']);
  });

  it('focuses nothing when every window refuses focus', () => {
    expect(subwindowStack([window('A', { unfocusable: true })]).focused).toBeNull();
  });
});

describe('rootEmbedsSubwindows — `display/window/subwindows/embed_subwindows`', () => {
  it('embeds by default (`project_settings.cpp:1756`)', () => {
    expect(rootEmbedsSubwindows(null)).toBe(true);
    expect(rootEmbedsSubwindows({})).toBe(true);
  });

  it('leaves the windows native when the project turns it off', () => {
    expect(rootEmbedsSubwindows({ 'display/window/subwindows/embed_subwindows': 'false' })).toBe(false);
  });
});
