/**
 * A shared contract test: every native leaf material must spread
 * `useControlClipPlanes()` onto its `clippingPlanes`, because a clip plane
 * array is per-MATERIAL state (`THREE.Material.clippingPlanes`), never
 * inherited by the scene graph the way a `THREE.Object3D` transform is
 * (`controlClipping.tsx`'s own doc). `StyleBoxQuad` and `ControlQuad` are the
 * two quad primitives every native Control painter is built from — a NEW
 * painter that reinvents its own raw `<mesh>` instead of one of these two
 * would need its own test, but a regression in EITHER shared primitive would
 * silently un-clip every painter built on it, which is the failure this
 * module exists to catch in one place rather than per consumer.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { ControlClipProvider } from './controlClipping';
import { ControlQuad } from './controlQuad';
import { StyleBoxQuad } from './StyleBoxQuad';
import type { StyleBoxFlatData } from './styleBoxFlat';
import type { Rect2 } from './rect';

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };
const ZERO_CORNERS = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };

const STYLE_BOX: StyleBoxFlatData = {
  bgColor: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
  borderColor: { r: 0, g: 0, b: 0, a: 1 },
  borderWidth: { ...ZERO_SIDES },
  cornerRadius: { ...ZERO_CORNERS },
  expandMargin: { ...ZERO_SIDES },
  contentMargin: { ...ZERO_SIDES },
  drawCenter: true,
  borderBlend: false,
};
const RECT: Rect2 = { x: 0, y: 0, w: 40, h: 20 };

function marker(): readonly THREE.Plane[] {
  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -1),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 2),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -3),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 4),
  ];
}

describe('every native quad primitive spreads useControlClipPlanes()', () => {
  it('<StyleBoxQuad> carries the provided planes on its material', async () => {
    const planes = marker();
    const renderer = await ReactThreeTestRenderer.create(
      <ControlClipProvider value={planes}>
        <StyleBoxQuad styleBox={STYLE_BOX} rect={RECT} renderOrder={0} />
      </ControlClipProvider>
    );
    const material = renderer.scene.findByType('Mesh').instance.material as THREE.Material;
    expect(material.clippingPlanes).toEqual(planes);
  });

  it('<StyleBoxQuad> carries an empty array outside any provider (never crashes, never clips)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StyleBoxQuad styleBox={STYLE_BOX} rect={RECT} renderOrder={0} />
    );
    const material = renderer.scene.findByType('Mesh').instance.material as THREE.Material;
    expect(material.clippingPlanes).toEqual([]);
  });

  it('<ControlQuad> carries the provided planes on its material', async () => {
    const planes = marker();
    const renderer = await ReactThreeTestRenderer.create(
      <ControlClipProvider value={planes}>
        <ControlQuad width={40} height={20} color={new THREE.Color(1, 1, 1)} opacity={1} renderOrder={0} />
      </ControlClipProvider>
    );
    const material = renderer.scene.findByType('Mesh').instance.material as THREE.Material;
    expect(material.clippingPlanes).toEqual(planes);
  });

  it('<ControlQuad> carries an empty array outside any provider', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ControlQuad width={40} height={20} color={new THREE.Color(1, 1, 1)} opacity={1} renderOrder={0} />
    );
    const material = renderer.scene.findByType('Mesh').instance.material as THREE.Material;
    expect(material.clippingPlanes).toEqual([]);
  });
});
