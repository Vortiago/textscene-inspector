/**
 * A modulate as the vertex colour a Godot mesh holds: four bytes for each vertex, each float32
 * channel clamped and cut, never rounded (`rendering_server.cpp:712-717`, `sprite_3d.cpp:223-228`).
 * Only a material that reads the vertex colour sees it.
 */
import * as THREE from 'three';
import { byteOf } from '../godot/project/image';
import type { Rgba } from '../godot/math/math';

const CHANNELS = 4;

/**
 * Writes `modulate` on every vertex of `colours`.
 *
 * @canonical A modulate as a mesh's vertex colour bytes
 */
export function writeVertexColour(colours: THREE.BufferAttribute, modulate: Rgba): void {
  const bytes = [modulate.r, modulate.g, modulate.b, modulate.a].map((channel) =>
    byteOf(Math.fround(channel))
  );
  // Into the array, not `setXYZW`: that rounds a normalised value, where Godot truncates.
  for (let vertex = 0; vertex < colours.count; vertex++) colours.array.set(bytes, vertex * CHANNELS);
  colours.needsUpdate = true;
}

/** The colour attribute of `vertexCount` vertices that all hold `modulate`. */
export function vertexColourAttribute(vertexCount: number, modulate: Rgba): THREE.BufferAttribute {
  const colours = new THREE.BufferAttribute(new Uint8Array(vertexCount * CHANNELS), CHANNELS, true);
  writeVertexColour(colours, modulate);
  return colours;
}
