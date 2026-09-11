/**
 * `<ColorPicker>` — the colour sample row plus the `SHAPE_HSV_RECTANGLE` SV
 * square/hue slider (`color_picker.cpp`/`color_picker_shape.cpp`, this
 * component's own doc for exact line citations).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { ColorPicker } from './Component';

const THEME = nativeTheme(1);

function node(properties: Record<string, unknown>): SolveNode {
  const tscnNode: TscnNode = { name: 'P', type: 'ColorPicker', children: [], properties };
  return { ...emptySolveNode(), path: 'P', node: tscnNode };
}

describe('<ColorPicker> (isolated painter contract)', () => {
  it('draws the sample swatch and the full SV-rectangle shape at the default picker_shape', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPicker
        {...painterEnv()}
        theme={THEME}
        solveNode={node({ color: 'Color(1, 0, 0, 1)' })}
        rect={{ x: 0, y: 0, w: 400, h: 400 }}
        renderOrder={0}
      />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    // swatch + (sv base, sv hue, cursor bg, cursor ring, hue strip, hue line)
    expect(meshes).toHaveLength(7);
  });

  it('draws the checkerboard only when the colour is translucent — color_picker.cpp:1400', async () => {
    const opaque = await ReactThreeTestRenderer.create(
      <ColorPicker {...painterEnv()} theme={THEME} solveNode={node({ color: 'Color(1, 0, 0, 1)' })} rect={{ x: 0, y: 0, w: 400, h: 400 }} renderOrder={0} />
    );
    const opaqueCount = opaque.scene.findAllByType('Mesh').length;

    const translucent = await ReactThreeTestRenderer.create(
      <ColorPicker {...painterEnv()} theme={THEME} solveNode={node({ color: 'Color(1, 0, 0, 0.5)' })} rect={{ x: 0, y: 0, w: 400, h: 400 }} renderOrder={0} />
    );
    expect(translucent.scene.findAllByType('Mesh').length).toBe(opaqueCount + 1);
  });

  it('draws an overbright indicator when a channel exceeds 1 — color_picker.cpp:1411-1413', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPicker {...painterEnv()} theme={THEME} solveNode={node({ color: 'Color(1.5, 0, 0, 1)' })} rect={{ x: 0, y: 0, w: 400, h: 400 }} renderOrder={0} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(8);
  });

  it('draws only the sample row for any picker_shape but SHAPE_HSV_RECTANGLE (0)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPicker {...painterEnv()} theme={THEME} solveNode={node({ color: 'Color(1, 0, 0, 1)', pickerShape: 1 })} rect={{ x: 0, y: 0, w: 400, h: 400 }} renderOrder={0} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('draws only the sample row at SHAPE_NONE (4), matching Godot exactly', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPicker {...painterEnv()} theme={THEME} solveNode={node({ color: 'Color(1, 0, 0, 1)', pickerShape: 4 })} rect={{ x: 0, y: 0, w: 400, h: 400 }} renderOrder={0} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('colours the SV square gradient at hue=0 (pure red) unmodulated by an opaque-white tint', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPicker {...painterEnv()} theme={THEME} solveNode={node({ color: 'Color(1, 0, 0, 1)' })} rect={{ x: 0, y: 0, w: 400, h: 400 }} renderOrder={0} />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    // index 1: sv hue layer (base=0, hue=1).
    const hueMesh = meshes[2]!.instance as THREE.Mesh;
    const color = hueMesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    // top-right vertex (index 1): full red, alpha 1.
    expect(color.getX(1)).toBeCloseTo(1);
    expect(color.getY(1)).toBeCloseTo(0);
    expect(color.getZ(1)).toBeCloseTo(0);
    expect(color.getW(1)).toBeCloseTo(1);
  });

  it('multiplies every gradient vertex by the walker-composed tint', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPicker
        {...painterEnv()}
        theme={THEME}
        tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
        solveNode={node({ color: 'Color(1, 0, 0, 1)' })}
        rect={{ x: 0, y: 0, w: 400, h: 400 }}
        renderOrder={0}
      />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    const baseMesh = meshes[1]!.instance as THREE.Mesh;
    const color = baseMesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    // top-left vertex is white(1,1,1,1) in the untinted layer; tinted by 0.5.
    expect(color.getX(0)).toBeCloseTo(0.5);
    expect(color.getY(0)).toBeCloseTo(0.5);
    expect(color.getZ(0)).toBeCloseTo(0.5);
  });

  it('positions the cursor at the square bounds for s=0, v=1 (pure white)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPicker {...painterEnv()} theme={THEME} solveNode={node({ color: 'Color(1, 1, 1, 1)' })} rect={{ x: 0, y: 0, w: 400, h: 400 }} renderOrder={0} />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    // Cursor bg is mesh index 3 (swatch, base, hue, cursorBg, cursorRing, hueStrip, hueLine);
    // its enclosing group sits at (cursorLocal - size/2), LOCAL to the
    // svSquare's own group (itself at (0, 0) since svSquare.x/y are 0).
    const cursorBgMesh = meshes[3]!.instance as THREE.Mesh;
    const groupPosition = cursorBgMesh.parent!.position;
    // s=0 -> cursor.x = svSquare.x = 0; v=1 -> cursor.y = svSquare.y = 0.
    // The group offsets by -size/2 in local x and +size/2 (negated) in y.
    expect(groupPosition.x).toBeCloseTo(-6);
    expect(groupPosition.y).toBeCloseTo(6);
  });
});
