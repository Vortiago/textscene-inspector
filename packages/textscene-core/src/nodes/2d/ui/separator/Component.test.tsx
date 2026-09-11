/**
 * `<SeparatorChrome>` (isolated painter contract) — `scene/gui/separator.cpp`
 * composed with whichever concrete StyleBox kind resolves
 * (`scene/resources/style_box_line.cpp`/`style_box_flat.cpp`, Godot 4.6.3).
 * Placement numbers are cross-checked in `separatorPlacement.test.ts`, the
 * line-draw transform in `native/styleBoxLineGeometry.test.ts`; this file
 * asserts the PAINTER wires the resolved StyleBox, the placement rect, and
 * the tint into the scene correctly, all now through `<StyleBoxQuad>`.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode, TscnInternalResource } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { ControlProperties } from '../control/types';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { resolveStyleBoxes } from '../../../../r3f/controls/native/buildSolveTree';
import { SeparatorChrome } from './Component';

const RECT = { x: 0, y: 0, w: 100, h: 25 };

function sepNode(
  type: string,
  properties: Partial<ControlProperties> = {},
  internalResources: readonly TscnInternalResource[] = []
): SolveNode {
  const node: TscnNode = { name: 'Sep', type, children: [], properties: { name: 'Sep', ...properties } as ControlProperties };
  return {
    ...emptySolveNode(),
    path: 'Sep',
    node,
    resources: { externalResources: [], internalResources },
  };
}

/** The wrapping group `SeparatorChrome` positions at the placement rect's own offset. */
function placementGroup(mesh: THREE.Mesh): THREE.Object3D {
  return mesh.parent!.parent!;
}

describe('<SeparatorChrome>', () => {
  it('draws the default-theme separator line at the geometry-derived rect for HSeparator', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SeparatorChrome {...painterEnv()} orientation="horizontal" solveNode={sepNode('HSeparator')} rect={RECT} renderOrder={0} />
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const geom = mesh.geometry;
    geom.computeBoundingBox();
    const bb = geom.boundingBox!;
    // native/styleBoxLineGeometry.test.ts: horizontal default theme, on a
    // (100, 0)-sized placed strip → {x:-1, y:0, w:102, h:1}.
    expect(bb.max.x - bb.min.x).toBeCloseTo(102);
    expect(bb.max.y - bb.min.y).toBeCloseTo(1);
    // separatorPlacementRect: HSeparator's default line margin is on
    // left/right only, so ssize.y=0 → y = truncHalf(25-0) = 12.
    const group = placementGroup(mesh);
    expect(group.position.x).toBeCloseTo(0);
    expect(group.position.y).toBeCloseTo(-12);
  });

  it('resolves a theme_override_styles/separator StyleBoxLine override instead of the default theme', async () => {
    const resources: TscnInternalResource[] = [
      {
        id: 'Line_1',
        type: 'StyleBoxLine',
        data: { color: 'Color(1, 0, 0, 1)', thickness: '4', vertical: 'true' },
      },
    ];
    const node = sepNode(
      'VSeparator',
      { themeOverrideStyles: { separator: 'SubResource("Line_1")' } },
      resources
    );
    // `SeparatorChrome` reads ONLY `solveNode.styleBoxes.separator` now —
    // resolved the same way the real walk resolves it, `resolveStyleBoxes`
    // itself (`buildSolveTree.ts`), not re-derived by hand.
    node.styleBoxes = resolveStyleBoxes(node.node, node.resources);
    const renderer = await ReactThreeTestRenderer.create(
      <SeparatorChrome {...painterEnv()} orientation="vertical" solveNode={node} rect={RECT} renderOrder={0} />
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const geom = mesh.geometry;
    geom.computeBoundingBox();
    const bb = geom.boundingBox!;
    // thickness=4 draws the line itself 4px wide (vertical → w = thickness).
    expect(bb.max.x - bb.min.x).toBeCloseTo(4);
    const color = geom.attributes.color as THREE.BufferAttribute;
    // Color(1,0,0,1) raw sRGB red, left undecoded on the vertex attribute.
    expect(color.getX(0)).toBeCloseTo(1, 4);
  });

  it('draws a StyleBoxFlat theme_override_styles/separator override at the STYLE-SIZED placed rect, not the whole Separator rect', async () => {
    const flatOverride = {
      bgColor: { r: 0, g: 1, b: 0, a: 1 },
      borderColor: { r: 0, g: 0, b: 0, a: 1 },
      borderWidth: { left: 0, top: 2, right: 0, bottom: 2 },
      cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
      expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
      contentMargin: { left: 0, top: 2, right: 0, bottom: 2 },
      drawCenter: true,
      borderBlend: false,
      antiAliased: false,
      aaSize: 1,
      cornerDetail: 8,
      shadowColor: { r: 0, g: 0, b: 0, a: 0 },
      shadowSize: 0,
      shadowOffset: { x: 0, y: 0 },
      skew: { x: 0, y: 0 },
    };
    const node: SolveNode = { ...sepNode('HSeparator'), styleBoxes: { separator: flatOverride } };
    const renderer = await ReactThreeTestRenderer.create(
      <SeparatorChrome {...painterEnv()} orientation="horizontal" solveNode={node} rect={RECT} renderOrder={0} />
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const geom = mesh.geometry;
    geom.computeBoundingBox();
    const bb = geom.boundingBox!;
    // separatorPlacementRect: h=25, ssize.y = 2+2 = 4 → placed = {x:0, y:10.5→10, w:100, h:4}.
    expect(bb.max.x - bb.min.x).toBeCloseTo(100);
    expect(bb.max.y - bb.min.y).toBeCloseTo(4);
    const group = placementGroup(mesh);
    expect(group.position.y).toBeCloseTo(-10);
  });

  it('composes tint into the default line colour, in raw sRGB, on the geometry\'s vertex colours', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SeparatorChrome
        {...painterEnv()}
        tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
        orientation="horizontal"
        solveNode={sepNode('HSeparator')}
        rect={RECT}
        renderOrder={0}
      />
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const geom = mesh.geometry;
    const color = geom.attributes.color as THREE.BufferAttribute;
    // style_separator_color 0.5 * tint 0.5 = 0.25, composed in raw sRGB (the
    // shader decodes it per fragment, not asserted here).
    expect(color.getX(0)).toBeCloseTo(0.25, 4);
    expect(color.getW(0)).toBeCloseTo(1, 4);
  });
});
