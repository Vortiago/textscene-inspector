import { describe, it, expect } from 'vitest';
import { keepsChildrenInViewport } from './viewportBoundary';

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
