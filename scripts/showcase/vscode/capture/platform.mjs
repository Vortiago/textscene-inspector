/**
 * The platform facts this harness branches on, and the sleep its poll loops use. Whether there is
 * an X server decides the launcher, the GL flags and how the process tree is killed.
 */

export const IS_WIN = process.platform === 'win32';
export const IS_LINUX = process.platform === 'linux';
// Linux with no X server drives VS Code under a virtual framebuffer.
export const HEADLESS = IS_LINUX && !process.env.DISPLAY;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
