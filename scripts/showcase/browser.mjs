/**
 * The headless Chromium launches of the repo's harnesses, one per flag set and browser. The
 * showcase launches read SHOWCASE_CHANNEL: unset gives system Chrome ('chrome'), 'bundled' gives
 * Playwright's bundled Chromium, and any other value names that Playwright channel. A capture that
 * a pixel compare reads always gets the bundled Chromium, pinned by the lockfile.
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

const GPU_COMPOSITED_ARGS = [...SWIFTSHADER_GL_ARGS, '--use-angle=swiftshader'];

export function launchShowcaseBrowser() {
  return launchShowcaseChannel(SWIFTSHADER_GL_ARGS);
}

/**
 * The same SwiftShader WebGL, composited in the GPU process as a browser with a GPU does. The
 * default software compositor reads the canvas back every frame and makes the main thread wait
 * for all queued GPU work, so it shows GPU time as main-thread long tasks (ADR-0042). ANGLE's
 * SwiftShader backend also rasterises differently, so a golden never uses this launch.
 */
export function launchGpuCompositedBrowser() {
  return launchShowcaseChannel(GPU_COMPOSITED_ARGS);
}

/**
 * The bundled Chromium with SwiftShader software GL, so local and CI render the same bits with no
 * GPU or driver variance. The goldens are captured through it.
 */
export function launchSwiftShaderBrowser() {
  return launchBundled(SWIFTSHADER_GL_ARGS);
}

/**
 * The bundled Chromium for a capture that measures against Godot. It composites in the GPU
 * process, so a screenshot is the drawing buffer. The default software compositor adds a ring of
 * about 6% outside each hard top and left edge, which Godot does not draw. A golden never uses
 * this launch, since its baselines carry that ring.
 */
export function launchGodotComparisonBrowser() {
  return launchBundled(GPU_COMPOSITED_ARGS);
}

function launchBundled(args) {
  return chromium.launch({ headless: true, args });
}

function launchShowcaseChannel(args) {
  return chromium.launch({
    channel:
      process.env.SHOWCASE_CHANNEL === 'bundled' ? undefined : process.env.SHOWCASE_CHANNEL || 'chrome',
    headless: true,
    args,
  });
}
