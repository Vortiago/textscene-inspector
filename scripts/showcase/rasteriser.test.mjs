/**
 * The rasteriser each launch gets in a real Chromium: a comparison capture runs on lavapipe, the
 * driver `pnpm ref:godot` uses, and a golden runs on SwiftShader. The lavapipe test needs the ICD
 * that `mesa-vulkan-drivers` installs, so it skips where that package is missing.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { launchGodotComparisonBrowser, launchSwiftShaderBrowser, readRasteriser } from './browser.mjs';

const LAVAPIPE_ICD = '/usr/share/vulkan/icd.d/lvp_icd.json';

async function rasteriserOf(launch) {
  const browser = await launch();
  try {
    return await readRasteriser(browser);
  } finally {
    await browser.close();
  }
}

describe('a launch in a real Chromium', () => {
  it.skipIf(!existsSync(LAVAPIPE_ICD))(
    `renders a comparison capture on lavapipe (skips without ${LAVAPIPE_ICD}, install mesa-vulkan-drivers)`,
    async () => {
      const { renderer, subpixelBits } = await rasteriserOf(launchGodotComparisonBrowser);
      expect(renderer).toMatch(/llvmpipe/i);
      expect(subpixelBits).toBe(8);
    },
    60_000
  );

  it('renders a golden on SwiftShader', async () => {
    const { renderer, subpixelBits } = await rasteriserOf(launchSwiftShaderBrowser);
    expect(renderer).toMatch(/SwiftShader/i);
    expect(subpixelBits).toBe(4);
  }, 60_000);
});
