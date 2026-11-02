/**
 * The Vulkan driver every Godot comparison renders on: lavapipe, for `pnpm ref:godot` and for the
 * browser capture it is measured against, so both sides rasterise on the same driver.
 */

/**
 * @canonical Pick the lavapipe Vulkan driver for a spawned process
 * The Vulkan loader picks lavapipe by its manifest name, `lvp_icd.json` on Debian and
 * `lvp_icd.x86_64.json` on Fedora, wherever it finds it. On a host with a GPU it would otherwise
 * pick the GPU's driver. The filter needs Vulkan loader 1.3.234 or later.
 */
export const LAVAPIPE_LOADER_ENV = { VK_LOADER_DRIVERS_SELECT: '*lvp*' };
