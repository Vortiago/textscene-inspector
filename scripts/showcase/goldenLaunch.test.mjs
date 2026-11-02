/**
 * The launch the goldens are captured through: the no-GPU path on every host. Playwright is
 * replaced, so the seam is the launch call it receives. `pnpm test:gpu` checks the rasteriser it
 * gets in a real Chromium.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const launch = vi.hoisted(() => vi.fn());
vi.mock('playwright', () => ({ chromium: { launch } }));

const { launchSwiftShaderBrowser } = await import('./browser.mjs');

describe('launchSwiftShaderBrowser', () => {
  beforeEach(() => launch.mockReset());

  it('disables the GPU, so a host with one renders as CI does', async () => {
    await launchSwiftShaderBrowser();
    expect(launch.mock.calls[0][0].args).toContain('--disable-gpu');
  });

  it('keeps WebGL alive on SwiftShader', async () => {
    await launchSwiftShaderBrowser();
    expect(launch.mock.calls[0][0].args).toContain('--enable-unsafe-swiftshader');
  });

  it('launches the bundled Chromium, not a system channel', async () => {
    await launchSwiftShaderBrowser();
    expect(launch.mock.calls[0][0].channel).toBeUndefined();
  });
});
