/**
 * The browser pages a run captures on, one per distinct kind of scene: the framed 3D view, the 2D
 * parity frame, and a 3D view per `canvas` size. A page opens before the first scene and closes
 * after the last scene that needs it, so a small-frame context does not outlive its scenes.
 */

import { attachDiagnostics, createCaptureContext, windowForCanvas } from '../previewServer.mjs';

function canvasKey({ width, height }) {
  return `${width}x${height}`;
}

/**
 * The key of the page a scene captures on, and the options its context opens with. A 3D scene is
 * framed on load: the app's default fixed orbit (ADR-0025) leaves the larger fixtures mostly out of
 * frame, and a baseline of empty space cannot fail. The parity harness keeps the fixed orbit, since
 * Godot opens there. A 2D scene keeps the parity frame's own origin and zoom.
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
  if (scene.canvas) {
    return {
      key: canvasKey(scene.canvas),
      options: { frameOnOpen: true, viewport: windowForCanvas(scene.canvas) },
    };
  }
  return { key: 'default', options: { frameOnOpen: true } };
}

async function openPage(browser, options) {
  const context = await createCaptureContext(browser, options);
  const page = await context.newPage();
  return { page, diagnostics: attachDiagnostics(page), context };
}

/**
 * Opens every page `scenes` need, together. `pageFor(scene)` is the page a scene captures on, and
 * `release(scene)` closes that page once no later scene uses it.
 */
export async function openPagePool(browser, scenes) {
  const specs = new Map(scenes.map((scene) => [pageSpecFor(scene).key, pageSpecFor(scene)]));
  const scenesLeft = new Map([...specs.keys()].map((key) => [key, 0]));
  for (const scene of scenes) {
    const { key } = pageSpecFor(scene);
    scenesLeft.set(key, scenesLeft.get(key) + 1);
  }
  const pages = new Map(
    await Promise.all([...specs].map(async ([key, spec]) => [key, await openPage(browser, spec.options)]))
  );
  return {
    pageFor: (scene) => pages.get(pageSpecFor(scene).key),
    async release(scene) {
      const { key } = pageSpecFor(scene);
      scenesLeft.set(key, scenesLeft.get(key) - 1);
      if (scenesLeft.get(key) === 0) await pages.get(key).context.close();
    },
  };
}
