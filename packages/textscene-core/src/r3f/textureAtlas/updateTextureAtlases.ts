/**
 * Godot's atlas step of a frame: it rebuilds the decal and area light atlases before it draws any
 * viewport (`renderer_rd/storage_rd/utilities.cpp:256-258`, `rendering_server_default.cpp:102`),
 * so an atlas copies a live target as it stood before this frame's passes.
 */

import type * as THREE from 'three';
import { updateDecalAtlas } from '../../nodes/3d/decal/decalAtlas.js';
import { updateAreaLightAtlas } from '../areaLight/areaLightAtlas.js';

export function updateTextureAtlases(gl: THREE.WebGLRenderer): void {
  updateDecalAtlas(gl.capabilities.maxTextureSize);
  updateAreaLightAtlas();
}
