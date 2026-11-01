/**
 * The headless Chromium launches of the repo's harnesses, one per flag set and browser. Only the
 * showcase recording reads SHOWCASE_CHANNEL: unset gives system Chrome ('chrome'), 'bundled' gives
 * Playwright's bundled Chromium, and any other value names that Playwright channel. Every gate and
 * capture gets the bundled Chromium, pinned by the lockfile, so it runs with no system Chrome.
 */
/* global document */ // The readRasteriser callback runs in the browser.
import { chromium } from 'playwright';
import { LAVAPIPE_LOADER_ENV } from '../godot-ref/lavapipe.mjs';

/**
 * ANGLE and SwiftShader let WebGL paint in software. Every Chromium launch in the repo (showcase,
 * VS Code capture, visual harness) shares these flags.
 */
export const SWIFTSHADER_GL_ARGS = [
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--use-gl=angle',
];

const GPU_COMPOSITED_ARGS = [...SWIFTSHADER_GL_ARGS, '--use-angle=swiftshader'];

export function launchShowcaseBrowser() {
  return chromium.launch({
    channel:
      process.env.SHOWCASE_CHANNEL === 'bundled' ? undefined : process.env.SHOWCASE_CHANNEL || 'chrome',
    headless: true,
    args: SWIFTSHADER_GL_ARGS,
  });
}

/**
 * The same SwiftShader WebGL, composited in the GPU process as a browser with a GPU does. The
 * default software compositor reads the canvas back every frame and makes the main thread wait
 * for all queued GPU work, so it shows GPU time as main-thread long tasks (ADR-0042). ANGLE's
 * SwiftShader backend also rasterises differently, so a golden never uses this launch.
 */
export function launchGpuCompositedBrowser() {
  return launchBundled(GPU_COMPOSITED_ARGS);
}

/**
 * The path a host with no GPU takes: SwiftShader WebGL, composited in software. On a host with a
 * GPU, ANGLE draws on that GPU, and a golden differs from CI's. `--disable-gpu` forces the software
 * path on every host, and `--enable-unsafe-swiftshader` keeps WebGL alive on it.
 */
const NO_GPU_ARGS = [...SWIFTSHADER_GL_ARGS, '--disable-gpu'];

/**
 * The bundled Chromium on the no-GPU path, so every host renders the bits CI renders. The goldens
 * are captured through it.
 */
export function launchSwiftShaderBrowser() {
  return launchBundled(NO_GPU_ARGS);
}

const LAVAPIPE_ARGS = [
  '--ignore-gpu-blocklist',
  '--use-gl=angle',
  '--use-angle=vulkan',
  '--enable-features=Vulkan',
  '--use-vulkan=native',
];

/** Lavapipe snaps a vertex to 1/256 px. SwiftShader snaps to 1/16 px (4 bits). */
const LAVAPIPE_SUBPIXEL_BITS = 8;

/**
 * The bundled Chromium for a capture that measures against Godot: ANGLE over lavapipe, the driver
 * `pnpm ref:godot` uses, composited in the GPU process so a screenshot is the drawing buffer.
 * It fails rather than fall back to SwiftShader, whose 1/16 px vertex snap moves quad edges.
 */
export async function launchGodotComparisonBrowser() {
  const browser = await chromium.launch({
    headless: true,
    args: LAVAPIPE_ARGS,
    env: { ...process.env, ...LAVAPIPE_LOADER_ENV },
  });
  try {
    assertLavapipe(await readRasteriser(browser));
  } catch (error) {
    await browser.close();
    throw error;
  }
  return browser;
}

/** The renderer string and sub-pixel bits that WebGL reports in `browser`. */
export async function readRasteriser(browser) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'no WebGL2 renderer info',
        subpixelBits: gl?.getParameter(gl.SUBPIXEL_BITS),
      };
    });
  } finally {
    await page.close();
  }
}

function assertLavapipe({ renderer, subpixelBits }) {
  if (/llvmpipe/i.test(renderer) && subpixelBits === LAVAPIPE_SUBPIXEL_BITS) return;
  throw new Error(
    `expected an llvmpipe renderer with ${LAVAPIPE_SUBPIXEL_BITS} sub-pixel bits, found "${renderer}" ` +
      `with ${subpixelBits} sub-pixel bits. Install mesa-vulkan-drivers.`
  );
}

function launchBundled(args) {
  return chromium.launch({ headless: true, args });
}
