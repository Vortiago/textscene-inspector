/**
 * The backdrop of a 3D sub-viewport's canvas samples the tonemapped world in the colour space the
 * canvas draws in. An HDR world holds linear half floats, which a linear canvas multiplies as they are
 * and an sRGB canvas would take for sRGB bytes.
 */
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { CanvasOverWorld } from './CanvasOverWorld';
import { createSceneTarget } from './offscreenViewport';
import {
  canvasColorSpaceOf,
  CanvasColorSpaceProvider,
  type CanvasColorSpace,
} from '../../../r3f/canvasColorSpace';

const LINEAR_CANVAS = canvasColorSpaceOf(true);

/** The `defines` of the backdrop material when it samples a world target made for `space`. */
async function backdropDefinesIn(space: CanvasColorSpace) {
  const world = createSceneTarget(8, 8, 'World', space);
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasColorSpaceProvider value={space}>
      <CanvasOverWorld size={{ x: 8, y: 8 }} world={world.texture} anchor={createRef()} />
    </CanvasColorSpaceProvider>
  );
  const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
    .material as THREE.MeshBasicMaterial;
  return material.defines;
}

describe('<CanvasOverWorld>', () => {
  it('adds no multiply to the 8-bit world of an sRGB canvas, which its target decodes in hardware', async () => {
    expect(Object.keys((await backdropDefinesIn(canvasColorSpaceOf(false))) ?? {})).toHaveLength(0);
  });

  it('samples the half-float world as it is when the canvas is linear', async () => {
    expect(Object.keys((await backdropDefinesIn(LINEAR_CANVAS)) ?? {})).toHaveLength(0);
  });
});
