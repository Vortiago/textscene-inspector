import { attachDiagnostics, loggedErrors } from '../visual/previewServer.mjs';
import { compareImages } from '../visual/imageDelta.mjs';
import { stillShot } from './stillShot.mjs';
import { MISSING_PATH, RESIDUE_MAX_DELTA } from './cameraFailures.mjs';

/* global window */
// These exist only in the browser that runs the `page.evaluate` calls.

const CAMERAS = ['Rig/Front', 'Above'];

/** The view's frame once `update` applies `options`. */
async function shotAfterUpdate(page, options) {
  await page.evaluate((next) => window.cameraView.update(next), options);
  return stillShot(page);
}

/** The view's frame through `camera`, with the editor gizmos on. */
const shotThrough = (page, camera) => shotAfterUpdate(page, { camera, show: { gizmos: true } });

/** The view's frame through `camera`, with the editor gizmos off. */
const shotWithoutGizmos = (page, camera) => shotAfterUpdate(page, { camera, show: { gizmos: false } });

/** The pixels past residue in which the game's view through `camera` differs from `shot`. */
async function overFromGame(page, camera, shot) {
  await page.evaluate((path) => window.mountGame(path), camera);
  return compareImages(await stillShot(page), shot, { overDelta: RESIDUE_MAX_DELTA }).over.pixels;
}

/** The message `update` throws for a camera path that names a MeshInstance3D. */
function refusedUpdate(page) {
  return page.evaluate(() => {
    try {
      window.cameraView.update({ camera: 'Cube' });
      return null;
    } catch (error) {
      return error.message;
    }
  });
}

/** The message `settled` rejects with for a view mounted through a path that names no node, or null. */
function missingCameraRejection(page) {
  return page.evaluate(async (camera) => {
    window.mountCamera({ mode: '3D', camera });
    try {
      await window.cameraView.settled;
      return null;
    } catch (error) {
      return error.message;
    }
  }, MISSING_PATH);
}

export async function runCameraChecks(page, url) {
  const diagnostics = attachDiagnostics(page);
  await page.goto(url);
  await page.waitForFunction(() => window.cameraView);
  const shots = {};
  for (const camera of CAMERAS) shots[camera] = await shotThrough(page, camera);
  const editor = await shotThrough(page, null);
  const refused = await refusedUpdate(page);
  await page.evaluate(() => window.mountCamera({ mode: '3D' }));
  const changedFromFreshEditor = compareImages(await stillShot(page), editor).changedPixels;
  const changedBetweenCameras = compareImages(shots['Rig/Front'], shots.Above).changedPixels;
  const gizmoPixels = {};
  const withoutGizmos = {};
  for (const camera of CAMERAS) {
    withoutGizmos[camera] = await shotWithoutGizmos(page, camera);
    gizmoPixels[camera] = compareImages(shots[camera], withoutGizmos[camera]).changedPixels;
  }
  const overFromGameView = {};
  for (const camera of CAMERAS)
    overFromGameView[camera] = await overFromGame(page, camera, withoutGizmos[camera]);
  const missing = await missingCameraRejection(page);
  await page.evaluate(() => window.cameraView.dispose());
  return {
    results: {
      overFromGameView,
      gizmoPixels,
      changedBetweenCameras,
      changedFromFreshEditor,
      refused,
      missing,
    },
    errors: loggedErrors(diagnostics),
  };
}
