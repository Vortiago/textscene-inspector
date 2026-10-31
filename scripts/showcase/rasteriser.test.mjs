/**
 * The rasteriser each launch gets in a real Chromium: a comparison capture runs on lavapipe, the
 * driver `pnpm ref:godot` uses, and a golden runs on SwiftShader. A test skips where its host lacks
 * the Playwright Chromium (the unit-test job installs none) or, for lavapipe, the ICD that
 * `mesa-vulkan-drivers` installs.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { launchGodotComparisonBrowser, launchSwiftShaderBrowser, readRasteriser } from './browser.mjs';

const LAVAPIPE_ICD = '/usr/share/vulkan/icd.d/lvp_icd.json';

async function hasChromium() {
  try {
    await (await launchSwiftShaderBrowser()).close();
    return true;
  } catch {
    return false; // Playwright's Chromium is not installed on this host.
  }
}

const chromiumInstalled = await hasChromium();

async function rasteriserOf(launch) {
  const browser = await launch();
  try {
    return await readRasteriser(browser);
  } finally {
    await browser.close();
  }
}

describe('a launch in a real Chromium', () => {
  it.skipIf(!chromiumInstalled || !existsSync(LAVAPIPE_ICD))(
    `renders a comparison capture on lavapipe (skips without ${LAVAPIPE_ICD}, install mesa-vulkan-drivers)`,
    async () => {
      const { renderer, subpixelBits } = await rasteriserOf(launchGodotComparisonBrowser);
      expect(renderer).toMatch(/llvmpipe/i);
      expect(subpixelBits).toBe(8);
    },
    60_000
  );

  it.skipIf(!chromiumInstalled)(
    'renders a golden on SwiftShader',
    async () => {
      const { renderer, subpixelBits } = await rasteriserOf(launchSwiftShaderBrowser);
      expect(renderer).toMatch(/SwiftShader/i);
      expect(subpixelBits).toBe(4);
    },
    60_000
  );
});
