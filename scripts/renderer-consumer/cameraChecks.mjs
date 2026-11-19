import { attachDiagnostics, loggedErrors } from '../visual/previewServer.mjs';
import { compareImages } from '../visual/imageDelta.mjs';
import { stillShot } from './stillShot.mjs';
import { RESIDUE_MAX_DELTA } from './cameraFailures.mjs';

/* global window */
// These exist only in the browser that runs the `page.evaluate` calls.

const CAMERAS = ['Rig/Front', 'Above'];

/** The view's frame once `update` moves it to `camera`. */
async function shotThrough(page, camera) {
  await page.evaluate((next) => window.cameraView.update({ camera: next }), camera);
  return stillShot(page);
}

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
  const overFromGameView = {};
  for (const camera of CAMERAS) overFromGameView[camera] = await overFromGame(page, camera, shots[camera]);
  await page.evaluate(() => window.cameraView.dispose());
  return {
    results: { overFromGameView, changedBetweenCameras, changedFromFreshEditor, refused },
    errors: loggedErrors(diagnostics),
  };
}
