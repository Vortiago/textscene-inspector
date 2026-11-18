import { describe, expect, it } from 'vitest';
import { targetRectInPane } from './windowFit';

const WINDOW = { size: { x: 100, y: 100 }, drawRect: { x: 10, y: 20, w: 50, h: 30 } };

describe('targetRectInPane', () => {
  it('scales the window to fill the pane, and the target with it, from the bottom-left', () => {
    expect(targetRectInPane({ x: 200, y: 200 }, WINDOW)).toEqual({ x: 20, y: 100, w: 100, h: 60 });
  });

  it('centres the window at one scale in a pane of another aspect', () => {
    expect(targetRectInPane({ x: 300, y: 100 }, WINDOW)).toEqual({ x: 110, y: 50, w: 50, h: 30 });
  });
});
