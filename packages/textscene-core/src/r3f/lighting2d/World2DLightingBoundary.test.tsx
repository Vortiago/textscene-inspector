/**
 * A SubViewport's canvas items live in its own World2D (`viewport.cpp:5345`), so the boundary
 * hides the main canvas's light pass and occluders from them.
 */

import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CanvasLighting2DProvider, useCanvasLighting2D, type CanvasLighting2D } from './CanvasLighting2D';
import { useRegisterCanvasLight2D } from './lightPassDeclarations';
import { useLightShadowCasters } from './ShadowCasterStage';
import { useShadowCaster, useShadowCasterRegistry } from './shadowCasterRegistry';
import { OCCLUDER_CULL_DISABLED } from './shadowVolumes';
import { World2DLightingBoundary } from './World2DLightingBoundary';

const SUN_KEY = { itemCullMask: null, zMin: -4096, zMax: 4096, layerMin: 0, layerMax: 0 };

interface Seen {
  outerLighting?: CanvasLighting2D;
  hasRegistry?: boolean;
  casterCount?: number;
}

/** Reads the outer canvas's light pass, beside an occluder of the outer canvas. */
function Outer({ seen }: { seen: Seen }) {
  const [object] = useState(() => new THREE.Group());
  useShadowCaster({
    segments: new Float32Array([0, 0, 0, 10, 0, 0]),
    cullMode: OCCLUDER_CULL_DISABLED,
    occluderLightMask: 1,
    object,
  });
  seen.outerLighting = useCanvasLighting2D();
  return null;
}

function Read({ seen }: { seen: Seen }) {
  useRegisterCanvasLight2D(true, SUN_KEY);
  seen.hasRegistry = useShadowCasterRegistry() !== null;
  seen.casterCount = useLightShadowCasters(true, 1).length;
  return null;
}

async function readInside(): Promise<Seen> {
  const seen: Seen = {};
  await ReactThreeTestRenderer.create(
    <CanvasLighting2DProvider canvasModulate={{ r: 1, g: 1, b: 1, a: 1 }}>
      <Outer seen={seen} />
      <World2DLightingBoundary>
        <Read seen={seen} />
      </World2DLightingBoundary>
    </CanvasLighting2DProvider>
  );
  await ReactThreeTestRenderer.act(async () => {});
  return seen;
}

describe('World2DLightingBoundary', () => {
  it('keeps a light inside from opening a class on the outer canvas', async () => {
    expect((await readInside()).outerLighting!.classes).toHaveLength(0);
  });

  it('withholds the occluder registry, so an occluder inside shadows no outer light', async () => {
    expect((await readInside()).hasRegistry).toBe(false);
  });

  it("hands a light inside none of the outer canvas's occluders", async () => {
    expect((await readInside()).casterCount).toBe(0);
  });
});
