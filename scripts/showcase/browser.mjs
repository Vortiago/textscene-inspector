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
  return chromium.launch({
    channel: process.env.SHOWCASE_CHANNEL === 'bundled' ? undefined : process.env.SHOWCASE_CHANNEL || 'chrome',
    headless: true,
    args: SWIFTSHADER_GL_ARGS,
  });
}
