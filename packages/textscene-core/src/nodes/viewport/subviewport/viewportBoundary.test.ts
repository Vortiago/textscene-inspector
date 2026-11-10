import { describe, it, expect } from 'vitest';
import type { TscnNode } from '../../../parser/types';
import {
  embedsAWindow,
  embedsSubwindows,
  isEmbeddedWindow,
  isSubViewport,
  isViewportBoundary,
  keepsChildrenInViewport,
} from './viewportBoundary';

describe('keepsChildrenInViewport', () => {
  it('keeps an ordinary node’s children in its viewport', () => {
    expect(keepsChildrenInViewport({ type: 'Node2D' })).toBe(true);
  });

  it('hands a SubViewport’s children to the SubViewport', () => {
    expect(keepsChildrenInViewport({ type: 'SubViewport' })).toBe(false);
  });

  it('keeps the children of the Control that displays a SubViewport in its own viewport', () => {
    expect(keepsChildrenInViewport({ type: 'SubViewportContainer' })).toBe(true);
  });
});

describe('a window is a viewport boundary', () => {
  it.each(['Window', 'Popup', 'PopupPanel'])('hands a %s’s children to its own viewport', (type) => {
    expect(isViewportBoundary(type)).toBe(true);
    expect(isEmbeddedWindow(type)).toBe(true);
  });

  it('shows only a SubViewport through a SubViewportContainer (`subviewport_container.cpp:134-145`)', () => {
    expect(isSubViewport('SubViewport')).toBe(true);
    expect(isSubViewport('Window')).toBe(false);
  });

  it('leaves a SubViewport out of the embedded windows', () => {
    expect(isEmbeddedWindow('SubViewport')).toBe(false);
  });
});

describe('embedsAWindow — whether a viewport draws a window over its canvas', () => {
  const node = (type: string, properties: Record<string, unknown> = {}, children: TscnNode[] = []) =>
    ({ name: type, type, properties, children, rawProperties: {} }) as unknown as TscnNode;

  it('finds a window below a viewport that embeds windows', () => {
    const viewport = node('SubViewport', { gui_embed_subwindows: true }, [
      node('Node', {}, [node('Window')]),
    ]);
    expect(embedsAWindow(viewport)).toBe(true);
  });

  it('finds none in a viewport that embeds no windows', () => {
    expect(embedsAWindow(node('SubViewport', { gui_embed_subwindows: false }, [node('Window')]))).toBe(false);
  });

  it('leaves out a window a nested viewport embeds, and reaches one past a viewport that embeds none', () => {
    const embedding = node('SubViewport', { gui_embed_subwindows: true }, [node('Window')]);
    const passing = node('SubViewport', { gui_embed_subwindows: false }, [node('Popup')]);
    expect(embedsAWindow(node('SubViewport', { gui_embed_subwindows: true }, [embedding]))).toBe(false);
    expect(embedsAWindow(node('SubViewport', { gui_embed_subwindows: true }, [passing]))).toBe(true);
  });

  it('leaves out a hidden window, which the embedder never registers (`window.cpp:1546-1563`)', () => {
    const viewport = node('SubViewport', { gui_embed_subwindows: true }, [node('Popup', { visible: false })]);
    expect(embedsAWindow(viewport)).toBe(false);
  });

  it('reaches a visible window below a hidden one', () => {
    const hidden = node('Window', { visible: false }, [node('Popup', { visible: true })]);
    expect(embedsAWindow(node('SubViewport', { gui_embed_subwindows: true }, [hidden]))).toBe(true);
  });

  it('leaves out a native window', () => {
    const viewport = node('SubViewport', { gui_embed_subwindows: true }, [
      node('Window', { force_native: true }),
    ]);
    expect(embedsAWindow(viewport)).toBe(false);
  });
});

describe('embedsSubwindows — whether a viewport is the embedder of the windows below it', () => {
  const node = (type: string, properties: Record<string, unknown>) => ({ type, properties });

  it('reads gui_embed_subwindows of a SubViewport', () => {
    expect(embedsSubwindows(node('SubViewport', { gui_embed_subwindows: true }))).toBe(true);
    expect(embedsSubwindows(node('SubViewport', { gui_embed_subwindows: false }))).toBe(false);
  });

  it('ignores the authored gui_embed_subwindows of a window, which entering the tree resets (`window.cpp:1534-1537`)', () => {
    expect(embedsSubwindows(node('Window', { gui_embed_subwindows: true, force_native: false }))).toBe(false);
  });

  it('lets a native window embed the windows below it, as entering the tree sets it to force_native', () => {
    expect(embedsSubwindows(node('Window', { gui_embed_subwindows: false, force_native: true }))).toBe(true);
  });
});
