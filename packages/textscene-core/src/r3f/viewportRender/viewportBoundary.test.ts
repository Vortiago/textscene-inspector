import { describe, it, expect } from 'vitest';
import {
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
