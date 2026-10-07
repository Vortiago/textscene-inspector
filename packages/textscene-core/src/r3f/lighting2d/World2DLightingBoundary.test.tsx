/**
 * A SubViewport's canvas items live in its own World2D (`viewport.cpp:5345`), so the boundary
 * hides the main canvas's light pass and occluders from them.
 */

import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CanvasLighting2DProvider, useCanvasLighting2D, type CanvasLighting2D } from './CanvasLighting2D';
import { directionalLightCullKey } from './lightCullKey';
import { useRegisterCanvasLight2D, useRegisterLitItem } from './lightPassDeclarations';
import { useLightShadowCasters } from './ShadowCasterStage';
import { useShadowCaster, useShadowCasterRegistry } from './shadowCasterRegistry';
import { OCCLUDER_CULL_DISABLED } from './shadowVolumes';
import { World2DLightingBoundary } from './World2DLightingBoundary';

const SUN = { reach: directionalLightCullKey(0, 0), shadowItemCullMask: null, tintsShadow: false };

interface Seen {
  outerLighting?: CanvasLighting2D;
  hasRegistry?: boolean;
  casterCount?: number;
}

/** Reads the outer canvas's light pass, beside an occluder and a lit item of the outer canvas. */
function Outer({ seen }: { seen: Seen }) {
  const [object] = useState(() => new THREE.Group());
  useRegisterLitItem({ lightMask: 1, z: 0, layer: 0 }, false);
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
  useRegisterCanvasLight2D(true, SUN);
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
  it('keeps a light inside from lighting an item on the outer canvas', async () => {
    expect((await readInside()).outerLighting!.lists.size).toBe(0);
  });

  it('withholds the occluder registry, so an occluder inside shadows no outer light', async () => {
    expect((await readInside()).hasRegistry).toBe(false);
  });

  it("hands a light inside none of the outer canvas's occluders", async () => {
    expect((await readInside()).casterCount).toBe(0);
  });
});
