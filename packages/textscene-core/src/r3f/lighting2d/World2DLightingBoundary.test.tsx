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
import { useShadowCaster, type ShadowCaster } from './shadowCasterRegistry';

import { World2DLightingBoundary } from './World2DLightingBoundary';
import { CanvasModulateContext, useCanvasModulate } from '../canvasModulate';
import type { Rgba } from '../../godot/math/math';
import { OccluderPolygon2DCullMode } from '../../godot/scene/lightOccluder2d';

const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };
const NIGHT: Rgba = { r: 0.2, g: 0.3, b: 0.6, a: 1 };

const SUN = {
  reach: directionalLightCullKey(0, 0),
  sequence: null,
  shadowItemCullMask: null,
  tintsShadow: false,
};

interface Seen {
  outerLighting?: CanvasLighting2D;
  outerCasterCount?: number;
  casterCount?: number;
}

/** An occluder of `light_mask` 1 under `object`. */
function occluder(object: THREE.Object3D): ShadowCaster {
  return {
    segments: new Float32Array([0, 0, 0, 10, 0, 0]),
    cullMode: OccluderPolygon2DCullMode.DISABLED,
    occluderLightMask: 1,
    object,
  };
}

/** Reads the outer canvas's light pass, beside an occluder and a lit item of the outer canvas. */
function Outer({ seen }: { seen: Seen }) {
  const [object] = useState(() => new THREE.Group());
  useRegisterLitItem({ lightMask: 1, z: 0, layer: 0, takenLights: null }, false);
  const [caster] = useState(() => occluder(object));
  useShadowCaster(caster);
  seen.outerLighting = useCanvasLighting2D();
  seen.outerCasterCount = useLightShadowCasters(true, 1).length;
  return null;
}

function Read({ seen }: { seen: Seen }) {
  const [caster] = useState(() => occluder(new THREE.Group()));
  useRegisterCanvasLight2D(true, SUN);
  useShadowCaster(caster);
  seen.casterCount = useLightShadowCasters(true, 1).length;
  return null;
}

async function readInside(): Promise<Seen> {
  const seen: Seen = {};
  await ReactThreeTestRenderer.create(
    <CanvasLighting2DProvider canvasModulate={{ r: 1, g: 1, b: 1, a: 1 }}>
      <Outer seen={seen} />
      <World2DLightingBoundary canvasModulate={WHITE}>
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
    expect((await readInside()).outerCasterCount).toBe(1);
  });

  it("hands a light inside none of the outer canvas's occluders", async () => {
    expect((await readInside()).casterCount).toBe(0);
  });

  it("publishes the canvas modulate of its own world, not the outer canvas's", async () => {
    let seen: Rgba | undefined;
    function ReadModulate() {
      seen = useCanvasModulate();
      return null;
    }
    await ReactThreeTestRenderer.create(
      <CanvasModulateContext.Provider value={NIGHT}>
        <World2DLightingBoundary canvasModulate={WHITE}>
          <ReadModulate />
        </World2DLightingBoundary>
      </CanvasModulateContext.Provider>
    );
    expect(seen).toEqual(WHITE);
  });
});
