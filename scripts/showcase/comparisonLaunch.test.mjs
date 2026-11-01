/**
 * The launch of a capture that measures against Godot: its flags, its Vulkan driver and its refusal
 * of any other rasteriser. Playwright is replaced, so the seam is the launch call it receives.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const launch = vi.hoisted(() => vi.fn());
vi.mock('playwright', () => ({ chromium: { launch } }));

const { launchGodotComparisonBrowser } = await import('./browser.mjs');
const { LAVAPIPE_LOADER_ENV } = await import('../godot-ref/lavapipe.mjs');

const LAVAPIPE = 'ANGLE (Mesa, Vulkan 1.4 (llvmpipe (LLVM 20.1.2 256 bits)), llvmpipe)';
const SWIFTSHADER = 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)';

function browserReporting(renderer, subpixelBits) {
  const close = vi.fn();
  const page = { close: vi.fn(), evaluate: vi.fn().mockResolvedValue({ renderer, subpixelBits }) };
  launch.mockResolvedValue({ newPage: async () => page, close });
  return { close };
}

describe('launchGodotComparisonBrowser', () => {
  beforeEach(() => launch.mockReset());

  it('rasterises through ANGLE on the Vulkan backend', async () => {
    browserReporting(LAVAPIPE, 8);
    await launchGodotComparisonBrowser();
    expect(launch.mock.calls[0][0].args).toEqual(
      expect.arrayContaining([
        '--use-gl=angle',
        '--use-angle=vulkan',
        '--enable-features=Vulkan',
        '--use-vulkan=native',
      ])
    );
    expect(launch.mock.calls[0][0].args).not.toContain('--use-angle=swiftshader');
  });

  it('makes the Vulkan loader pick lavapipe, the driver `pnpm ref:godot` renders on', async () => {
    browserReporting(LAVAPIPE, 8);
    await launchGodotComparisonBrowser();
    expect(launch.mock.calls[0][0].env).toMatchObject(LAVAPIPE_LOADER_ENV);
  });

  it('refuses SwiftShader, names it and closes the browser', async () => {
    const { close } = browserReporting(SWIFTSHADER, 4);
    await expect(launchGodotComparisonBrowser()).rejects.toThrow(
      /expected an llvmpipe renderer with 8 sub-pixel bits, found .*SwiftShader.* with 4 sub-pixel bits.*mesa-vulkan-drivers/s
    );
    expect(close).toHaveBeenCalled();
  });

  it('refuses llvmpipe that reports 4 sub-pixel bits', async () => {
    browserReporting(LAVAPIPE, 4);
    await expect(launchGodotComparisonBrowser()).rejects.toThrow(/with 4 sub-pixel bits/);
  });
});
