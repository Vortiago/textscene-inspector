import { describe, expect, it } from 'vitest';
import { CANVAS_2D_TESTIDS } from './appContract.mjs';
import { paintedOutChromeCss } from './captureContext.mjs';

describe('paintedOutChromeCss', () => {
  it('hides the chrome that floats over the canvas in both modes', () => {
    for (const canvas2D of [false, true]) {
      const css = paintedOutChromeCss({ canvas2D });
      expect(css).toContain('[data-testid="viewport-toolbar-overlay"]');
      expect(css).toContain('[data-testid="viewport-controls-help"]');
      expect(css).toContain('{display:none !important}');
    }
  });

  it('paints out the 2D stage only for a 2D capture', () => {
    const css2D = paintedOutChromeCss({ canvas2D: true });
    expect(css2D).toContain(`[data-testid="${CANVAS_2D_TESTIDS.frame}"]`);

    const css3D = paintedOutChromeCss({ canvas2D: false });
    expect(css3D).not.toContain(CANVAS_2D_TESTIDS.frame);
    expect(css3D).not.toContain(CANVAS_2D_TESTIDS.stage);
  });
});
