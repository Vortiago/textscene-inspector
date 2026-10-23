/**
 * The browser pages a run captures on, one per distinct kind of scene: the framed 3D view, the 2D
 * parity frame, and a 3D view per `canvas` size. A page opens before the first scene and closes
 * after the last scene that needs it, so a small-frame context does not outlive its scenes. A scene
 * that sets `gizmos: true` gets a page of its own kind, since the toggle is set when the context opens.
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

/** The page key and options a scene's `gizmos: true` adds: the Gizmos toggle on, on a page of its own. */
function gizmosSpec(scene, key) {
  return scene.gizmos === true
    ? { key: `${key}+gizmos`, options: { showGizmos: true } }
    : { key, options: {} };
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
    const gizmos = gizmosSpec(scene, '2d');
    return { key: gizmos.key, options: { frameOnOpen: false, canvas2D: true, ...gizmos.options } };
  }
  const canvas = scene.canvas ?? CANVAS_CAPTURE;
  const gizmos = gizmosSpec(scene, canvasKey(canvas));
  return {
    key: gizmos.key,
    options: { frameOnOpen: true, viewport: windowForCanvas(canvas), ...gizmos.options },
  };
}

async function openPage(browser, options) {
  const context = await createCaptureContext(browser, options);
  const page = await context.newPage();
  return { context, pageState: { page, diagnostics: attachDiagnostics(page) } };
}

/**
 * Opens every page `scenes` need, together. `use(scene, capture)` runs `capture` on the page of the
 * scene's kind, and closes that page after the last scene of the kind. The returned `scenes` is the
 * run order, a kind's scenes together: a page left on its last scene keeps rendering it, which
 * starves the next page's requests on a two-core runner.
 */
export async function openPagePool(browser, scenes) {
  const specs = new Map(scenes.map((scene) => [scene, pageSpecFor(scene)]));
  const sceneGroups = Map.groupBy(scenes, (scene) => specs.get(scene).key);
  const kinds = new Map(
    [...sceneGroups].map(([key, group]) => [
      key,
      { options: specs.get(group[0]).options, scenesLeft: group.length },
    ])
  );
  await Promise.all(
    [...kinds.values()].map(async (kind) => Object.assign(kind, await openPage(browser, kind.options)))
  );
  return {
    scenes: [...sceneGroups.values()].flat(),
    async use(scene, capture) {
      const kind = kinds.get(specs.get(scene)?.key);
      if (!kind || kind.scenesLeft === 0) {
        throw new Error(`scene "${scene.name}" has no open page: it is not in the run, or ran twice`);
      }
      try {
        return await capture(kind.pageState);
      } finally {
        kind.scenesLeft -= 1;
        if (kind.scenesLeft === 0) await kind.context.close();
      }
    },
  };
}
