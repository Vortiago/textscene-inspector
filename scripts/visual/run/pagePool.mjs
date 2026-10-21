/**
 * The browser pages a run captures on, one per distinct kind of scene: the framed 3D view, the 2D
 * parity frame, and a 3D view per `canvas` size. A page opens before the first scene and closes
 * after the last scene that needs it, so a small-frame context does not outlive its scenes.
 */

import {
  attachDiagnostics,
  CANVAS_CAPTURE,
  createCaptureContext,
  windowForCanvas,
} from '../previewServer.mjs';

function canvasKey({ width, height }) {
  return `${width}x${height}`;
}

/**
 * The key of the page a scene captures on, and the options its context opens with. A 3D scene is
 * framed on load: the app's default fixed orbit (ADR-0025) leaves the larger fixtures mostly out of
 * frame, and a baseline of empty space cannot fail. The parity harness keeps the fixed orbit.
 */
export function pageSpecFor(scene) {
  if (scene.mode === '2d') {
    if (scene.canvas) {
      throw new Error(
        `scene "${scene.name}" sets a canvas size, which only a 3D scene uses: expected no canvas ` +
          `with mode "2d", got ${canvasKey(scene.canvas)}`
      );
    }
    return { key: '2d', options: { frameOnOpen: false, canvas2D: true } };
  }
  const canvas = scene.canvas ?? CANVAS_CAPTURE;
  return {
    key: canvasKey(canvas),
    options: { frameOnOpen: true, viewport: windowForCanvas(canvas) },
  };
}

async function openPage(browser, options) {
  const context = await createCaptureContext(browser, options);
  const page = await context.newPage();
  return { context, pageState: { page, diagnostics: attachDiagnostics(page) } };
}

/**
 * Opens every page `scenes` need, together. `use(scene, capture)` runs `capture` on the page of the
 * scene's kind, and closes that page after the last scene of the kind.
 */
export async function openPagePool(browser, scenes) {
  const kinds = new Map();
  for (const { key, options } of scenes.map(pageSpecFor)) {
    const kind = kinds.get(key) ?? { options, scenesLeft: 0 };
    kind.scenesLeft += 1;
    kinds.set(key, kind);
  }
  await Promise.all(
    [...kinds.values()].map(async (kind) => Object.assign(kind, await openPage(browser, kind.options)))
  );
  return {
    async use(scene, capture) {
      const kind = kinds.get(pageSpecFor(scene).key);
      try {
        return await capture(kind.pageState);
      } finally {
        kind.scenesLeft -= 1;
        if (kind.scenesLeft === 0) await kind.context.close();
      }
    },
  };
}
