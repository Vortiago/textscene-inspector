/**
 * Godot's atlas step of a frame: it rebuilds the decal and area light atlases before it draws any
 * viewport (`renderer_rd/storage_rd/utilities.cpp:256-258`, `rendering_server_default.cpp:102`),
 * so an atlas copies a live target as it stood before this frame's passes.
 */

import { useEffect } from 'react';
import type * as THREE from 'three';
import { updateDecalAtlas } from '../../nodes/3d/decal/decalAtlas.js';
import { updateAreaLightAtlas } from '../areaLight/areaLightAtlas.js';

/** The mounted frame loops that take the atlas step. Written only by `useTextureAtlasFrame`. */
let frameLoops = 0;

export function updateTextureAtlases(gl: THREE.WebGLRenderer): void {
  updateDecalAtlas(gl.capabilities.maxTextureSize);
  updateAreaLightAtlas();
}

/** Declares that this component's frame loop calls `updateTextureAtlases` before each frame's renders. */
export function useTextureAtlasFrame(): void {
  useEffect(() => {
    frameLoops++;
    return () => {
      frameLoops--;
    };
  }, []);
}

/**
 * Whether a frame loop rebuilds the atlases before every frame's renders. A render with no such
 * loop above it, as in a test, rebuilds the atlas it reads itself.
 */
export function areAtlasesUpdatedPerFrame(): boolean {
  return frameLoops > 0;
}
