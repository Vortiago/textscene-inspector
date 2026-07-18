/**
 * Shared headless-browser launch for the showcase harnesses. The SwiftShader
 * flags make WebGL render headlessly; SHOWCASE_CHANNEL picks the browser:
 * unset → system Chrome ('chrome'), 'bundled' → Playwright's bundled Chromium,
 * any other value → that Playwright channel.
 */
import { chromium } from 'playwright';

/**
 * The headless-WebGL contract: force ANGLE + SwiftShader so WebGL paints in
 * software (never --disable-gpu, which kills WebGL). Shared by every Chromium
 * launch in the repo — showcase, VS Code capture, visual harness — so a flag
 * rename lands in one place.
 */
export const SWIFTSHADER_GL_ARGS = [
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--use-gl=angle',
];

export function launchShowcaseBrowser() {
  return chromium.launch({
    channel: process.env.SHOWCASE_CHANNEL === 'bundled' ? undefined : process.env.SHOWCASE_CHANNEL || 'chrome',
    headless: true,
    args: SWIFTSHADER_GL_ARGS,
  });
}
