/**
 * The shared headless-browser launch for the showcase harnesses. SHOWCASE_CHANNEL picks the
 * browser: unset gives system Chrome ('chrome'), 'bundled' gives Playwright's bundled Chromium,
 * and any other value names that Playwright channel.
 */
import { chromium } from 'playwright';

/**
 * ANGLE and SwiftShader make WebGL paint in software, where --disable-gpu would kill WebGL. Every
 * Chromium launch in the repo (showcase, VS Code capture, visual harness) shares these flags.
 */
export const SWIFTSHADER_GL_ARGS = [
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--use-gl=angle',
];

export function launchShowcaseBrowser() {
  return launchWithArgs(SWIFTSHADER_GL_ARGS);
}

/**
 * The same SwiftShader WebGL, composited in the GPU process as a browser with a GPU does. The
 * default software compositor reads the canvas back every frame and makes the main thread wait
 * for all queued GPU work, so it shows GPU time as main-thread long tasks (ADR-0042). ANGLE's
 * SwiftShader backend also rasterises differently, so a golden never uses this launch.
 */
export function launchGpuCompositedBrowser() {
  return launchWithArgs([...SWIFTSHADER_GL_ARGS, '--use-angle=swiftshader']);
}

function launchWithArgs(args) {
  return chromium.launch({
    channel: process.env.SHOWCASE_CHANNEL === 'bundled' ? undefined : process.env.SHOWCASE_CHANNEL || 'chrome',
    headless: true,
    args,
  });
}
