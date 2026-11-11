/**
 * The mask a `clip_children` owner draws with: the buffer's colour under the owner's own alpha, as
 * Godot's default clip shader (`renderer_canvas_render_rd.cpp:2096-2111`), added to each owner mesh.
 */

import type * as THREE from 'three';
import { CanvasItemMaterialBlendMode } from '../../godot/scene/canvasItemMaterial';
import { canvasItemBlendState } from '../../resources/materials/canvasitemmaterial/build';
import type { ProgramInjection } from '../materialProgramInputs';
import { editedProgram } from '../shaderPatch/chunkPatch';

export interface ClipMask {
  readonly injection: ProgramInjection;
  /** Points the mask at the texture of the owner's group buffer. */
  readBuffer(texture: THREE.Texture): void;
  /**
   * The owner's pixels take the buffer's colour from `startMasking` to `stopMasking`. The buffer is
   * bound to the program only then: WebGL refuses a draw into a target whose texture a sampler of
   * the program holds, even when the shader never reads it.
   */
  startMasking(): void;
  stopMasking(): void;
}

/**
 * The buffer sample comes after `colorspace_fragment`: the buffer holds the canvas's own numbers,
 * which the program would otherwise encode a second time. The alpha is the owner's before its
 * lighting, since Godot's clip shader replaces the owner's material (a LIGHT_ONLY one included).
 */
const MASK_GLSL = `#include <colorspace_fragment>
if (uClipMasking > 0.5) {
  gl_FragColor.rgb = texelFetch(uClipBuffer, ivec2(gl_FragCoord.xy), 0).rgb;
  gl_FragColor.a = diffuseColor.a;
}`;

const UNIFORMS_GLSL = `uniform sampler2D uClipBuffer;
uniform float uClipMasking;
void main() {`;

/** The blend Godot's clip children shader draws with, whatever material the owner carries. */
const MIX_BLEND = canvasItemBlendState(CanvasItemMaterialBlendMode.MIX);
const BLEND_FIELDS = Object.keys(MIX_BLEND) as (keyof typeof MIX_BLEND)[];

/**
 * A mask of one owner. Its uniforms stay the same objects for the owner's life: three keeps the ones
 * `onBeforeCompile` first assigned, and a material is never recompiled for a new object.
 */
export function createClipMask(): ClipMask {
  const uniforms = { uClipBuffer: { value: null as THREE.Texture | null }, uClipMasking: { value: 0 } };
  let buffer: THREE.Texture | null = null;
  let isMasked = false;
  // The materials the owner compiled. While masked, each maps to the blend its `CanvasItemMaterial`
  // held when the mask took over: a prop change lands only between masked draws, so it is current.
  const materials = new Set<THREE.Material>();
  const ownBlends = new Map<THREE.Material, Partial<THREE.Material>>();
  const takeMixBlend = (material: THREE.Material) => {
    ownBlends.set(material, Object.fromEntries(BLEND_FIELDS.map((field) => [field, material[field]])));
    Object.assign(material, MIX_BLEND);
  };
  const restoreOwnBlend = (material: THREE.Material) => {
    Object.assign(material, ownBlends.get(material));
    ownBlends.delete(material);
  };
  const setMasking = (isMasking: boolean) => {
    if (isMasked === isMasking) return;
    isMasked = isMasking;
    uniforms.uClipMasking.value = isMasking ? 1 : 0;
    uniforms.uClipBuffer.value = isMasking ? buffer : null;
    for (const material of materials) (isMasking ? takeMixBlend : restoreOwnBlend)(material);
  };

  return {
    injection: {
      cacheKey: 'godot-clip-children',
      onBeforeCompile: function (shader) {
        // Once per material: a recompile while masked would read the MIX blend as the owner's own.
        if (!materials.has(this)) {
          materials.add(this);
          this.addEventListener('dispose', () => {
            materials.delete(this);
            ownBlends.delete(this);
          });
          if (isMasked) takeMixBlend(this);
        }
        Object.assign(shader.uniforms, uniforms);
        editedProgram(
          shader,
          {
            fragment: [
              { three: 'void main() {', godot: UNIFORMS_GLSL },
              { three: '#include <colorspace_fragment>', godot: MASK_GLSL },
            ],
          },
          'clip children mask'
        );
      },
    },
    readBuffer: (texture) => {
      buffer = texture;
    },
    startMasking: () => setMasking(true),
    stopMasking: () => setMasking(false),
  };
}
