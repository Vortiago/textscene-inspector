/**
 * The colour of a shadow atlas: the depth again, as two bytes, that a depth draw writes
 * (`atlasDepthMaterials.ts`) and a blocker search reads raw (`godotRawDepth`). Godot reads its depth
 * with a second, uncompared sampler (`scene_forward_lights_inc.glsl:398`), and a lit draw cannot read
 * one depth texture both ways.
 */

import * as THREE from 'three';
import { sharedTexture } from '../sharedTexture.js';

export class AtlasColourTexture extends sharedTexture(THREE.Texture) {
  constructor(name: string, size: number) {
    super();
    this.name = name;
    this.image = { width: size, height: size, depth: 1 };
    this.format = THREE.RGFormat;
    this.type = THREE.UnsignedByteType;
    this.minFilter = THREE.NearestFilter;
    this.magFilter = THREE.NearestFilter;
    this.generateMipmaps = false;
    this.flipY = false;
  }
}
