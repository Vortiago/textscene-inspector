/**
 * The mask a `clip_children` owner draws with: the colour of the group buffer at the fragment under
 * the owner's own alpha. It is Godot's default clip children shader, `COLOR.rgb = c.rgb` of an
 * unshaded sample of the back buffer (`renderer_canvas_render_rd.cpp:2096-2111`), added to the
 * program of each mesh the owner draws.
 */

import * as THREE from 'three';
import type { ProgramInjection } from '../materialProgramInputs';
import { editedProgram } from '../shaderPatch/chunkPatch';

export interface ClipMask {
  readonly injection: ProgramInjection;
  /** Points the mask at the texture of the owner's group buffer. */
  readBuffer(texture: THREE.Texture): void;
  /**
   * Whether the owner's pixels take the buffer's colour. The pass sets it, per draw. The buffer is
   * bound to the program only while it is on: WebGL refuses a draw into a target whose texture a
   * sampler of the program holds, even when the shader never reads it.
   */
  setMasking(isMasking: boolean): void;
}

/**
 * The buffer sample comes after `colorspace_fragment`: the buffer holds the canvas's own numbers,
 * which the program would otherwise encode a second time.
 */
const MASK_GLSL = `#include <colorspace_fragment>
if (uClipMasking > 0.5) gl_FragColor.rgb = texelFetch(uClipBuffer, ivec2(gl_FragCoord.xy), 0).rgb;`;

const UNIFORMS_GLSL = `uniform sampler2D uClipBuffer;
uniform float uClipMasking;
void main() {`;

/** The blend fields a material has, and the MIX blend Godot's clip shader draws with. */
const BLEND_FIELDS = [
  'blending',
  'blendEquation',
  'blendSrc',
  'blendDst',
  'blendEquationAlpha',
  'blendSrcAlpha',
  'blendDstAlpha',
] as const;
const MIX_BLEND: Partial<THREE.Material> = {
  blending: THREE.NormalBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendEquationAlpha: THREE.AddEquation,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
};

/**
 * A mask of one owner. Its uniforms stay the same objects for the owner's life: three keeps the ones
 * `onBeforeCompile` first assigned, and a material is never recompiled for a new object.
 */
export function createClipMask(): ClipMask {
  const uniforms = { uClipBuffer: { value: null as THREE.Texture | null }, uClipMasking: { value: 0 } };
  let buffer: THREE.Texture | null = null;
  // The materials the owner compiled, each with the blend of its `CanvasItemMaterial`.
  const ownBlends = new Map<THREE.Material, Partial<THREE.Material>>();
  return {
    injection: {
      cacheKey: 'godot-clip-children',
      onBeforeCompile: function (shader) {
        ownBlends.set(this, Object.fromEntries(BLEND_FIELDS.map((field) => [field, this[field]])));
        this.addEventListener('dispose', () => ownBlends.delete(this));
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
    setMasking: (isMasking) => {
      uniforms.uClipMasking.value = isMasking ? 1 : 0;
      uniforms.uClipBuffer.value = isMasking ? buffer : null;
      for (const [material, own] of ownBlends) Object.assign(material, isMasking ? MIX_BLEND : own);
    },
  };
}
