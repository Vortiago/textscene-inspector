/**
 * Test-only: waits until an area light shows. A light hides until Godot's LTC tables load, an
 * import whose time varies with the module cache, so a test that reads the light before it may
 * find no slot.
 */

import type * as THREE from 'three';
import { expect, vi } from 'vitest';

/** The first load imports the largest data module, which a cold transform can take seconds over. */
const LTC_LOAD_TIMEOUT_MS = 5000;

export async function untilAreaLightShows(light: THREE.RectAreaLight): Promise<void> {
  await vi.waitFor(() => expect(light.visible).toBe(true), { interval: 5, timeout: LTC_LOAD_TIMEOUT_MS });
}
