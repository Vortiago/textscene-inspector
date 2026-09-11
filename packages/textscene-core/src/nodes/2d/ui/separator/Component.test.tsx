/**
 * `<SeparatorChrome>` (isolated painter contract) — `scene/gui/separator.cpp`
 * composed with `scene/resources/style_box_line.cpp` (Godot 4.6.3). Exact
 * numbers are cross-checked in `styleBoxLineGeometry.test.ts`; this file
 * asserts the PAINTER wires that geometry, the resolved StyleBox, and the
 * tint into the scene correctly.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode, TscnInternalResource } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { ControlProperties } from '../control/types';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
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

describe('<SeparatorChrome>', () => {
  it('draws the default-theme separator line at the geometry-derived rect for HSeparator', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SeparatorChrome {...painterEnv()} orientation="horizontal" solveNode={sepNode('HSeparator')} rect={RECT} renderOrder={0} />
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const geom = mesh.geometry as THREE.PlaneGeometry;
    // styleBoxLineGeometry.test.ts: horizontal default theme, h=25 → {x:-1,y:12,w:102,h:1}.
    expect(geom.parameters.width).toBeCloseTo(102);
    expect(geom.parameters.height).toBeCloseTo(1);
    const group = mesh.parent as THREE.Group;
    expect(group.position.x).toBeCloseTo(-1);
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
    const renderer = await ReactThreeTestRenderer.create(
      <SeparatorChrome {...painterEnv()} orientation="vertical" solveNode={node} rect={RECT} renderOrder={0} />
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const geom = mesh.geometry as THREE.PlaneGeometry;
    // thickness=4 draws the line itself 4px wide (vertical → w = thickness).
    expect(geom.parameters.width).toBeCloseTo(4);
    const mat = mesh.material as THREE.MeshBasicMaterial;
    // Color(1,0,0,1) raw sRGB red, linear-converted — red channel stays 1.
    expect(mat.color.r).toBeCloseTo(1, 4);
  });

  it('draws a StyleBoxFlat/Empty theme_override_styles/separator override via StyleBoxQuad, in preference to any StyleBoxLine resolution', async () => {
    const flatOverride = {
      bgColor: { r: 0, g: 1, b: 0, a: 1 },
      borderColor: { r: 0, g: 0, b: 0, a: 1 },
      borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
      cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
      expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
      contentMargin: { left: 0, top: 0, right: 0, bottom: 0 },
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
    const node: SolveNode = { ...sepNode('HSeparator'), styleBoxes: { separator: flatOverride } };
    const renderer = await ReactThreeTestRenderer.create(
      <SeparatorChrome {...painterEnv()} orientation="horizontal" solveNode={node} rect={RECT} renderOrder={0} />
    );
    // StyleBoxQuad builds a hand-rolled BufferGeometry (vertex colours), not a planeGeometry.
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    expect(mesh.geometry).not.toBeInstanceOf(THREE.PlaneGeometry);
  });

  it('composes tint into the default line colour before the sRGB→linear conversion', async () => {
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
    const mat = mesh.material as THREE.MeshBasicMaterial;
    // style_separator_color 0.5 * tint 0.5 = 0.25, sRGB, then linearised.
    expect(mat.opacity).toBeCloseTo(1, 4);
    expect(mat.color.r).toBeLessThan(0.5);
  });
});
