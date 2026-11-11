/**
 * The Chromium launches the spike measures with: the two the repository's harnesses already use,
 * one with a WebGPU adapter, and one on the machine's own GPU. Dawn gives its SwiftShader adapter
 * under the lavapipe flags too, so no launch draws WebGPU on lavapipe.
 */

import { chromium } from 'playwright';
import { launchGodotComparisonBrowser, launchSwiftShaderBrowser } from '../showcase/browser.mjs';

/**
 * WebGPU on Dawn's own SwiftShader Vulkan. `--use-vulkan=swiftshader` composites in the GPU process:
 * without it a screenshot of a WebGPU canvas is blank, and so is a 2D copy of it.
 */
const WEBGPU_SWIFTSHADER_ARGS = [
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-webgpu',
  '--enable-features=Vulkan',
  '--use-vulkan=swiftshader',
  '--use-webgpu-adapter=swiftshader',
];

const LAUNCHES = {
  swiftshader: launchSwiftShaderBrowser,
  lavapipe: launchGodotComparisonBrowser,
  'webgpu-swiftshader': () => chromium.launch({ headless: true, args: WEBGPU_SWIFTSHADER_ARGS }),
  // A window on the machine's own GPU, for a frame time that means something. Not for a container.
  hardware: () => chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu'] }),
};

export function launchSpikeBrowser(name) {
  const launch = LAUNCHES[name];
  if (!launch) throw new Error(`expected one of ${Object.keys(LAUNCHES).join(', ')}, got ${name}`);
  return launch();
}
