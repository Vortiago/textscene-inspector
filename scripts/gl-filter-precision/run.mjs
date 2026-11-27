import { launchGodotComparisonBrowser, launchSwiftShaderBrowser } from '../showcase/browser.mjs';
import { filterPrecision } from './page.mjs';

/** The goldens' GL and the GL `pnpm ref:diff` measures against Godot on (ADR-0094's table). */
const LAUNCHES = { SwiftShader: launchSwiftShaderBrowser, lavapipe: launchGodotComparisonBrowser };

for (const [gl, launch] of Object.entries(LAUNCHES)) {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    console.log(gl, JSON.stringify(await page.evaluate(filterPrecision)));
  } finally {
    await browser.close();
  }
}
