/**
 * Godot's default CanvasGroup shader (`renderer_canvas_render_rd.cpp:2072-2088`): the rect reads
 * the group's buffer at its own pixel, un-premultiplies it and multiplies it by the group colour,
 * unshaded, so no light and no canvas modulate reach it (`canvas.glsl:719-720`).
 */

import * as THREE from 'three';
import { canvasItemFacing } from '../../../r3f/canvasItemFacing';

/** `c.a > 0.0001` guards the divide, as Godot's shader does. */
const compositeFragment = /* glsl */ `
uniform sampler2D buffer;
uniform vec4 colour;
void main() {
  vec4 c = texelFetch(buffer, ivec2(gl_FragCoord.xy), 0);
  if (c.a > 0.0001) c.rgb /= c.a;
  gl_FragColor = colour * c;
}`;

/**
 * The material of a group's composite rect over `buffer`. `colour` holds the group colour in the
 * canvas's own numbers, since the fragment writes them as they are: the buffer holds the same.
 */
export function createCompositeMaterial(buffer: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'CanvasGroup::composite',
    uniforms: { buffer: { value: buffer }, colour: { value: new THREE.Vector4(1, 1, 1, 1) } },
    fragmentShader: compositeFragment,
    transparent: true,
    depthWrite: false,
    ...canvasItemFacing(),
  });
}
