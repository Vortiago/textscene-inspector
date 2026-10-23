import { describe, expect, it } from 'vitest';
import { CANVAS_2D_TESTIDS, PERFORMANCE_TESTIDS, SHOW_GIZMOS_STORAGE_KEY } from './appContract.mjs';
import { createCaptureContext, paintedOutChromeCss } from './captureContext.mjs';

/** A browser that records the localStorage entries a context seeds, as `[key, value]` pairs. */
function recordingBrowser() {
  const seeded = new Map();
  const context = {
    addInitScript: async (_script, argument) => {
      if (Array.isArray(argument)) seeded.set(argument[0], argument[1]);
    },
  };
  return { browser: { newContext: async () => context }, seeded };
}

describe('createCaptureContext', () => {
  it('seeds the Gizmos toggle off, so no golden or comparison capture shows a gizmo', async () => {
    const { browser, seeded } = recordingBrowser();
    await createCaptureContext(browser, { frameOnOpen: true });
    expect(seeded.get(SHOW_GIZMOS_STORAGE_KEY)).toBe('false');
  });

  it('seeds the Gizmos toggle on for a scene that asks for gizmos', async () => {
    const { browser, seeded } = recordingBrowser();
    await createCaptureContext(browser, { frameOnOpen: true, showGizmos: true });
    expect(seeded.get(SHOW_GIZMOS_STORAGE_KEY)).toBe('true');
  });
});

describe('paintedOutChromeCss', () => {
  it('hides the chrome that floats over the canvas in both modes', () => {
    for (const canvas2D of [false, true]) {
      const css = paintedOutChromeCss({ canvas2D });
      expect(css).toContain('[data-testid="viewport-toolbar-overlay"]');
      expect(css).toContain('[data-testid="viewport-controls-help"]');
      expect(css).toContain('button[title*="switch to the 2D view"]');
      expect(css).toContain(`[data-testid="${PERFORMANCE_TESTIDS.overlay}"]`);
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
