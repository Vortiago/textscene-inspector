/**
 * Shared headless-browser launch for the showcase harnesses. The SwiftShader
 * flags make WebGL render headlessly; SHOWCASE_CHANNEL picks the browser:
 * unset → system Chrome ('chrome'), 'bundled' → Playwright's bundled Chromium,
 * any other value → that Playwright channel.
 */
import { chromium } from 'playwright';

export function launchShowcaseBrowser() {
  return chromium.launch({
    channel: process.env.SHOWCASE_CHANNEL === 'bundled' ? undefined : process.env.SHOWCASE_CHANNEL || 'chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'],
  });
}
