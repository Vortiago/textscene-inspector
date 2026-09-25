/**
 * Tests the `<ReferenceRect>` painter against `scene/gui/reference_rect.cpp` and
 * the unfilled `draw_rect` of `scene/main/canvas_item.cpp`.
 * `borderGeometry.test.ts` checks the exact quads.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { ReferenceRectProperties } from './types';
import { SelectionProvider } from '../../../../r3f/contexts/SelectionContext';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { ReferenceRect } from './Component';
import { SelectSeeder } from '../../../../r3f/testing/SelectSeeder';

const RECT = { x: 0, y: 0, w: 100, h: 50 };

function refRectNode(properties: Partial<ReferenceRectProperties> = {}, path = 'MyRect'): SolveNode {
  const node: TscnNode = {
    name: 'MyRect',
    type: 'ReferenceRect',
    children: [],
    properties: { name: 'MyRect', ...properties } as ReferenceRectProperties,
  };
  return { ...emptySolveNode(), path, node };
}

describe('<ReferenceRect> (isolated painter contract)', () => {
  it('draws the border quads for the resolved rect and border_width (borderGeometry.test.ts locks the exact numbers)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ReferenceRect
        {...painterEnv()}
        solveNode={refRectNode({ borderWidth: 2, editorOnly: false })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(4);
  });

  it('draws unconditionally when editor_only is false, with no selection in scope', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ReferenceRect
        {...painterEnv()}
        solveNode={refRectNode({ editorOnly: false })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(0);
  });

  it('draws nothing when editor_only is true (the default) and this node is not selected', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <ReferenceRect {...painterEnv()} solveNode={refRectNode({})} rect={RECT} renderOrder={0} />
      </SelectionProvider>
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('draws when editor_only is true and this node IS the current selection', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <SelectSeeder path="MyRect" />
        <ReferenceRect {...painterEnv()} solveNode={refRectNode({})} rect={RECT} renderOrder={0} />
      </SelectionProvider>
    );
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(0);
  });

  it('draws nothing when editor_only is true and a DIFFERENT node is selected', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <SelectSeeder path="Other" />
        <ReferenceRect {...painterEnv()} solveNode={refRectNode({})} rect={RECT} renderOrder={0} />
      </SelectionProvider>
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('composes tint into border_color in sRGB before the single linear conversion', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ReferenceRect
        {...painterEnv()}
        tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
        solveNode={refRectNode({ borderColor: 'Color(1, 0, 0, 1)', editorOnly: false })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const mesh = renderer.scene.findAllByType('Mesh')[0]!.instance as THREE.Mesh;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    // border_color(1,0,0) * tint(0.5) = 0.5 red in sRGB, then linearised: below the untinted value.
    expect(mat.color.r).toBeGreaterThan(0);
    expect(mat.color.r).toBeLessThan(1);
  });
});
