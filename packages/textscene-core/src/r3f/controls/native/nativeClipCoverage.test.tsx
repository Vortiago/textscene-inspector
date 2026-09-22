/**
 * A shared contract test: every native leaf material must spread
 * `useControlClipPlanes()` onto its `clippingPlanes`, because a clip plane
 * array is per-MATERIAL state (`THREE.Material.clippingPlanes`), never
 * inherited by the scene graph the way a `THREE.Object3D` transform is
 * (`controlClipping.tsx`'s own doc). `StyleBoxQuad` and `ControlQuad` are the
 * two quad primitives every native Control painter is built from, and a
 * regression in EITHER would silently un-clip every painter built on it —
 * which is the failure the first half of this module catches in one place
 * rather than per consumer.
 *
 * The second half catches what a per-primitive test structurally cannot: a
 * painter that mounts something else — a raw `<mesh>`, a `<TextRun>` — and
 * forgets to hand it the ambient planes. It mounts a real clipping Control
 * through the real walker and asserts that NOTHING it draws is left
 * unclipped. `GraphNode`/`GraphFrame` title text escaped exactly that way,
 * visible only as a few hundred pixels of text outside a GraphEdit whose
 * children had scrolled out of its own rect.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { ControlClipProvider } from './controlClipping';
import { ControlQuad } from './controlQuad';
import { StyleBoxQuad } from './StyleBoxQuad';
import type { StyleBoxFlatData } from './styleBoxFlat';
import type { Rect2 } from './rect';
import { ControlCanvasLayer } from './ControlCanvasLayer';
import { CanvasWorkspaceProvider } from '../../contexts/CanvasWorkspaceContext';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { SceneResourcesProvider } from '../../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';

import '../../nodes/index';
import '../index';

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
  antiAliased: true,
  aaSize: 1,
  cornerDetail: 8,
  skew: { x: 0, y: 0 },
  shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
  shadowSize: 0,
  shadowOffset: { x: 0, y: 0 },
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
      <ControlClipProvider value={{ planes, rect: null }}>
        <StyleBoxQuad styleBox={STYLE_BOX} rect={RECT} renderOrder={0} />
      </ControlClipProvider>
    );
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material;
    expect(material.clippingPlanes).toEqual(planes);
  });

  it('<StyleBoxQuad> carries an empty array outside any provider (never crashes, never clips)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StyleBoxQuad styleBox={STYLE_BOX} rect={RECT} renderOrder={0} />
    );
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material;
    expect(material.clippingPlanes).toEqual([]);
  });

  it('<ControlQuad> carries the provided planes on its material', async () => {
    const planes = marker();
    const renderer = await ReactThreeTestRenderer.create(
      <ControlClipProvider value={{ planes, rect: null }}>
        <ControlQuad width={40} height={20} color={new THREE.Color(1, 1, 1)} opacity={1} renderOrder={0} />
      </ControlClipProvider>
    );
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material;
    expect(material.clippingPlanes).toEqual(planes);
  });

  it('<ControlQuad> carries an empty array outside any provider', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ControlQuad width={40} height={20} color={new THREE.Color(1, 1, 1)} opacity={1} renderOrder={0} />
    );
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material;
    expect(material.clippingPlanes).toEqual([]);
  });
});

/**
 * The other half of the same mechanism: a per-material plane array is inert
 * unless its RENDERER opted in, because three gates the whole local-clipping
 * path on one renderer flag (`WebGLRenderer.localClippingEnabled` →
 * `WebGLClipping.init`'s `localClippingEnabled`). A renderer left at the
 * default silently ignores every `clippingPlanes` array the tests above pin,
 * with no error and no warning — the failure is a ScrollContainer that simply
 * does not clip.
 *
 * Every canvas that mounts `ControlRasterLayer`/`ControlCanvasLayer` therefore
 * has to set it, the 3D canvas included: a Control-only SubViewport sampled by
 * a 3D scene renders its Controls through THAT canvas's renderer
 * (`renderToOffscreenTarget` takes the live `useThree().gl`, never a renderer
 * of its own), so the flag has to be true wherever a Control can be drawn
 * rather than only where the 2D workspace draws one.
 */
describe('local clipping is enabled on every canvas that draws Controls', () => {
  const CANVAS_SOURCES = [
    ['World2DCanvas.tsx', join(import.meta.dirname, '../../components/Canvas2DStage/World2DCanvas.tsx')],
    ['TscnCanvas.tsx', join(import.meta.dirname, '../../TscnCanvas.tsx')],
  ] as const;

  it.each(CANVAS_SOURCES)('%s passes localClippingEnabled to its <Canvas>', (_name, path) => {
    // Line comments stripped first, and `<Canvas\s` rather than `<Canvas\b`:
    // both files name `<Canvas>` in prose, and a `>` inside a comment would
    // otherwise end the non-greedy match before the props (the same reading
    // `World2DCanvas.test.tsx` does for `flat`).
    const canvasTag = /<Canvas\s[\s\S]*?>/.exec(readFileSync(path, 'utf8').replace(/\/\/.*$/gm, ''))?.[0] ?? '';
    expect(canvasTag).not.toBe('');
    expect(canvasTag).toMatch(/localClippingEnabled:\s*true/);
  });
});

/**
 * `Control::set_clip_contents(true)` is a property of the CONTROL, so it has
 * to reach every pixel that control's painter draws, whatever primitive drew
 * it. `GraphEdit` sets it in its own constructor (`graph_edit.cpp:3342`) and
 * `ScrollContainer` from the property, so both are real clipping ancestors to
 * mount a subtree under.
 *
 * Reads the WHOLE rendered tree rather than a named painter: the point is to
 * fail for a primitive nobody thought to list, which is how this regression
 * arrived.
 */
async function meshesOf(tscn: string): Promise<THREE.Mesh[]> {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={parsed.internalResources}
          externalResources={parsed.externalResources}
        >
          <SelectionProvider>
            <ControlCanvasLayer nodes={parsed.nodes} />
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 20));
  const first = (renderer.scene as unknown as { children?: Array<{ instance?: THREE.Object3D }> })
    .children?.[0]?.instance;
  let root: THREE.Object3D | null | undefined = first;
  while (root?.parent) root = root.parent;
  const found: THREE.Mesh[] = [];
  root?.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) found.push(o as THREE.Mesh);
  });
  return found;
}

/** The node path a mesh hangs under, so a failure names the painter. */
function ownerOf(mesh: THREE.Object3D): string {
  const parts: string[] = [];
  for (let a: THREE.Object3D | null = mesh; a; a = a.parent) if (a.name) parts.unshift(a.name);
  return parts.join('/');
}

function unclipped(meshes: readonly THREE.Mesh[]): string[] {
  return meshes
    .filter((m) => {
      const planes = (m.material as THREE.Material).clippingPlanes;
      return !Array.isArray(planes) || planes.length === 0;
    })
    .map(ownerOf);
}

describe('a clipping Control clips everything its own painters draw', () => {
  it('leaves nothing under a GraphEdit unclipped — titles included', async () => {
    const meshes = await meshesOf(`[gd_scene format=3]

[node name="Root" type="Control"]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0

[node name="Graph" type="GraphEdit" parent="."]
offset_right = 400.0
offset_bottom = 320.0

[node name="Frame" type="GraphFrame" parent="Graph"]
offset_right = 360.0
offset_bottom = 140.0
title = "Group"

[node name="Node" type="GraphNode" parent="Graph"]
offset_right = 120.0
offset_bottom = 64.0
position_offset = Vector2(40, 56)
title = "Add"
`);
    expect(meshes.length).toBeGreaterThan(0);
    expect(unclipped(meshes)).toEqual([]);
  });

  it('leaves nothing under a ScrollContainer unclipped', async () => {
    const meshes = await meshesOf(`[gd_scene format=3]

[node name="Root" type="Control"]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0

[node name="Scroll" type="ScrollContainer" parent="."]
offset_right = 200.0
offset_bottom = 120.0

[node name="Inner" type="Label" parent="Scroll"]
text = "Scrolled"
`);
    expect(meshes.length).toBeGreaterThan(0);
    expect(unclipped(meshes)).toEqual([]);
  });
});
