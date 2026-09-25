/**
 * `<ColorPickerButton>`: the Button chrome, then a checkerboard and a colour
 * swatch inset by the content margins of "normal" (`color_picker.cpp:2426-2434`).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { ColorPickerButton } from './Component';

function node(properties: Record<string, unknown>): SolveNode {
  const tscnNode: TscnNode = { name: 'C', type: 'ColorPickerButton', children: [], properties };
  return { ...emptySolveNode(), path: 'C', node: tscnNode };
}

describe('<ColorPickerButton> (isolated painter contract)', () => {
  it('draws the button chrome plus a checkerboard and swatch inset by the normal StyleBox margins (4px at scale 1)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPickerButton
        {...painterEnv()}
        solveNode={node({ color: 'Color(0.8, 0.3, 0.5, 0.6)' })}
        rect={{ x: 0, y: 0, w: 100, h: 40 }}
        renderOrder={0}
      />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    // Button's own StyleBoxQuad (no text/icon authored) + checkerboard + swatch.
    expect(meshes).toHaveLength(3);

    const swatchMesh = meshes[2]!.instance as THREE.Mesh;
    const geometry = swatchMesh.geometry as THREE.PlaneGeometry;
    expect(geometry.parameters.width).toBe(92);
    expect(geometry.parameters.height).toBe(32);
    const material = swatchMesh.material as THREE.MeshBasicMaterial;
    expect(material.opacity).toBeCloseTo(0.6);
    expect(material.map).toBeNull();

    const checkerboardMesh = meshes[1]!.instance as THREE.Mesh;
    expect((checkerboardMesh.material as THREE.MeshBasicMaterial).map).not.toBeNull();
  });

  it('draws opaque black when the parser has already substituted its default — color_picker.h:513 Color()', async () => {
    // The parser writes `Color(0, 0, 0, 1)` for an absent `color`. This pins the
    // painter on that string, not the white fallback of `parseColor`.
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPickerButton
        {...painterEnv()}
        solveNode={node({ color: 'Color(0, 0, 0, 1)' })}
        rect={{ x: 0, y: 0, w: 50, h: 24 }}
        renderOrder={0}
      />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    const swatchMesh = meshes[meshes.length - 1]!.instance as THREE.Mesh;
    const material = swatchMesh.material as THREE.MeshBasicMaterial;
    expect(material.color.r).toBeCloseTo(0);
    expect(material.color.g).toBeCloseTo(0);
    expect(material.color.b).toBeCloseTo(0);
    expect(material.opacity).toBe(1);
  });

  it('draws no swatch/checkerboard once the rect is too small for the content margins (edge)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPickerButton
        {...painterEnv()}
        solveNode={node({ color: 'Color(1, 0, 0, 1)' })}
        rect={{ x: 0, y: 0, w: 4, h: 4 }}
        renderOrder={0}
      />
    );
    // Only Button's own StyleBoxQuad remains.
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('draws an overbright indicator quad when a channel exceeds 1 — color_picker.cpp:2431', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPickerButton
        {...painterEnv()}
        solveNode={node({ color: 'Color(1.5, 0.2, 0.2, 1)' })}
        rect={{ x: 0, y: 0, w: 100, h: 40 }}
        renderOrder={0}
      />
    );
    // Button chrome + checkerboard + swatch + overbright indicator.
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(4);
  });

  it('multiplies the swatch by the walker-composed tint before its single sRGB→linear conversion', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPickerButton
        {...painterEnv()}
        tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 0.5 })}
        solveNode={node({ color: 'Color(0.8, 0.4, 0.2, 1)' })}
        rect={{ x: 0, y: 0, w: 100, h: 40 }}
        renderOrder={0}
      />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    const swatchMesh = meshes[meshes.length - 1]!.instance as THREE.Mesh;
    const material = swatchMesh.material as THREE.MeshBasicMaterial;
    // own(sRGB) = tint(0.5,0.5,0.5) * color(0.8,0.4,0.2) = (0.4, 0.2, 0.1)
    const expected = new THREE.Color().setRGB(0.4, 0.2, 0.1, THREE.SRGBColorSpace);
    expect(material.color.r).toBeCloseTo(expected.r);
    expect(material.color.g).toBeCloseTo(expected.g);
    expect(material.color.b).toBeCloseTo(expected.b);
    expect(material.opacity).toBeCloseTo(0.5);
  });
});
