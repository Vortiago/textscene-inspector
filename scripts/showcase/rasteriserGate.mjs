#!/usr/bin/env node
/**
 * `pnpm test:gpu`: each launch gets its rasteriser in a real Chromium. A comparison capture runs on
 * lavapipe, the driver `pnpm ref:godot` uses, and a golden runs on SwiftShader. The gate needs
 * `mesa-vulkan-drivers`, so a host without it fails here and names the package.
 */
import { launchGodotComparisonBrowser, launchSwiftShaderBrowser, readRasteriser } from './browser.mjs';

async function rasteriserOf(launch) {
  const browser = await launch();
  try {
    return await readRasteriser(browser);
  } finally {
    await browser.close();
  }
}

const comparison = await rasteriserOf(launchGodotComparisonBrowser);
const golden = await rasteriserOf(launchSwiftShaderBrowser);

const failures = [];
if (!/llvmpipe/i.test(comparison.renderer) || comparison.subpixelBits !== 8)
  failures.push(`the comparison launch reports ${JSON.stringify(comparison)}, expected llvmpipe with 8 bits`);
if (!/SwiftShader/i.test(golden.renderer) || golden.subpixelBits !== 4)
  failures.push(`the golden launch reports ${JSON.stringify(golden)}, expected SwiftShader with 4 bits`);

if (failures.length) {
  for (const failure of failures) console.error(`[rasteriser] ${failure}`);
  process.exit(1);
}
console.log('[rasteriser] comparison on lavapipe, golden on SwiftShader');
