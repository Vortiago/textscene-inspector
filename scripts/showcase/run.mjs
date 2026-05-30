/**
 * Parameterized showcase recorder.
 *   node scripts/showcase/run.mjs "<fixture label>" "<output-name>"
 *
 * Selects the fixture from the scene dropdown, lets the camera auto-fit settle,
 * orbits the camera to show the scene in 3D, and writes docs/showcase/web/<name>.webm.
 */
import { recordShowcase } from './record.mjs';

const label = process.argv[2];
const name = process.argv[3] || (label || 'clip').toLowerCase().replace(/[^a-z0-9]+/g, '-');

if (!label) {
  console.error('usage: node scripts/showcase/run.mjs "<fixture label>" "<output-name>"');
  process.exit(1);
}

await recordShowcase(name, async (page, { selectScene, orbit }) => {
  await selectScene(page, label);
  await page.waitForTimeout(1000); // let CameraFit settle on the new scene
  await orbit(page, { dx: 230, dy: 35, steps: 55 });
  await page.waitForTimeout(300);
  // Poster frame for quick verification + the showcase index thumbnail.
  await page.screenshot({ path: `docs/showcase/web/${name}.png` });
  await page.waitForTimeout(300);
});
