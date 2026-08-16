/**
 * `<SubViewportContainer>`'s composited quad must carry the walker's own
 * `tint` exactly like every other native painter's pixels do — measured
 * against Godot 4.6.3 on a scratch fixture
 * (not committed; see the Item 2 write-up in `comparison.md`): a
 * `ColorRect(0.8, 0.8, 0.8)` filling the sub-viewport reads back through the
 * container as rgb(204,204,204) with no tint, rgb(102,102,102) with
 * `self_modulate = Color(0.5, 0.5, 0.5, 1)`, and rgb(51,51,51) with BOTH an
 * ancestor `modulate = Color(0.5, 0.5, 0.5, 1)` AND that same `self_modulate`
 * — a plain multiply in the same sRGB-friendly space the content colour is
 * authored in (0.8 × 0.5 × 0.5 = 0.2, and 0.2 × 255 = 51 exactly), not a
 * double gamma application.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useEffect } from 'react';
import * as THREE from 'three';

import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import {
  ViewportTextureProvider,
  useRegisterViewportTexture,
  type ViewportTextureEntry,
} from '../../../../r3f/contexts/ViewportTextureContext';
import { SubViewportContainer } from './Component';
import { ControlCanvasWalker } from '../../../../r3f/controls/native/ControlCanvasWalker';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function node(name: string, type: string, properties: object, children: TscnNode[] = []): TscnNode {
  return { name, type, children, properties: { name, ...properties } } as TscnNode;
}

function containerSolveNode(containerProps: object): SolveNode {
  const containerNode = node('Booth', 'SubViewportContainer', containerProps, [
    node('View', 'SubViewport', { size: { x: 200, y: 150 }, transparent_bg: false }),
  ]);
  return { ...solveNode(), path: 'Booth', node: containerNode };
}

const RECT: Rect2 = { x: 0, y: 0, w: 200, h: 150 };

function Publisher({ path, entry }: { path: string; entry: ViewportTextureEntry }) {
  const register = useRegisterViewportTexture();
  useEffect(() => register(path, entry), [register, path, entry]);
  return null;
}

function fakeEntry(): ViewportTextureEntry {
  return { texture: new THREE.Texture(), size: { x: 200, y: 150 } };
}

async function mountContainer(tint = painterTint()) {
  const entry = fakeEntry();
  const renderer = await ReactThreeTestRenderer.create(
    <ViewportTextureProvider>
      <Publisher path="Booth/View" entry={entry} />
      <SubViewportContainer
        {...painterEnv()}
        tint={tint}
        solveNode={containerSolveNode({})}
        rect={RECT}
        renderOrder={0}
      />
    </ViewportTextureProvider>
  );
  const quad = renderer.scene
    .findAll(() => true)
    .map((n) => n.instance as THREE.Mesh)
    .find((m) => (m.material as THREE.MeshBasicMaterial | undefined)?.map === entry.texture);
  return quad!.material as THREE.MeshBasicMaterial;
}

describe('<SubViewportContainer> modulate / self_modulate', () => {
  it('composes an authored modulate AND self_modulate through the real walker, exactly once', async () => {
    // The measured chain above, end to end: 0.5 x 0.5 = 0.25 on the quad, so a
    // 0.8 content texel reads 0.8 x 0.25 = 0.2 -> rgb(51). Authored on the NODE
    // (not handed in as a tint) because that fold is the walker's, and this is
    // the only test in this file that can catch it being applied twice.
    controlComponentRegistry.register({ typeName: 'SubViewportContainer', Component: SubViewportContainer });
    controlSolverRegistry.clear();
    const entry = fakeEntry();
    const root: SolveNode = {
      ...solveNode(),
      path: 'Booth',
      node: node('Booth', 'SubViewportContainer', {
        anchorsPreset: 15,
        modulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
        selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
      }, [node('View', 'SubViewport', { size: { x: 200, y: 150 }, transparent_bg: false })]),
    };

    const renderer = await ReactThreeTestRenderer.create(
      <ViewportTextureProvider>
        <Publisher path="Booth/View" entry={entry} />
        <ControlCanvasWalker
          tree={[root]}
          generation={0}
          viewport={{ x: 0, y: 0, w: 200, h: 150 }}
          theme={nativeTheme(1)}
          measurer={null}
        />
      </ViewportTextureProvider>
    );

    const material = renderer.scene
      .findAll(() => true)
      .map((n) => n.instance as THREE.Mesh)
      .find((m) => (m.material as THREE.MeshBasicMaterial | undefined)?.map === entry.texture)!
      .material as THREE.MeshBasicMaterial;
    expect(material.color.r).toBeCloseTo(srgbToLinear(0.25), 4);

    controlComponentRegistry.clear();
  });

  it('draws opaque white with no tint authored', async () => {
    const material = await mountContainer();
    expect(material.color.r).toBeCloseTo(1, 5);
    expect(material.opacity).toBeCloseTo(1, 5);
  });

  it('draws the composited quad at the tint the walker composed', async () => {
    const material = await mountContainer(painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 }));
    // `useGodotLinearColor` converts the sRGB-authored 0.5 to the renderer's
    // linear working space — NOT 0.5 itself — so the assertion compares
    // against sRGB→linear(0.5), the same conversion every other tinted
    // native painter's material colour already goes through.
    const expected = srgbToLinear(0.5);
    expect(material.color.r).toBeCloseTo(expected, 4);
    expect(material.opacity).toBeCloseTo(1, 5);
  });

  it("carries the tint's alpha onto the composited quad opacity", async () => {
    const material = await mountContainer(painterTint({ r: 1, g: 1, b: 1, a: 0.5 }));
    expect(material.opacity).toBeCloseTo(0.5, 5);
  });
});

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
