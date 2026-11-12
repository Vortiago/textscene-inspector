/**
 * The surfaced mesh drawer at one place: each part of a mesh once, with the material of each
 * surface, the instance materials of the enclosing GeometryInstance3D and every `next_pass` chain
 * (`render_forward_clustered.cpp:4183-4241`).
 */
import { describe, expect, it } from 'vitest';
import { useRef } from 'react';
import * as THREE from 'three';
import { parseTransform3D } from '../../utils/transform';
import { nextPassRenderOrder } from '../materials/passOrder';
import { decomposeForR3F } from '../nodeTransform';
import { SurfacedMeshDrawer } from './SurfacedMeshDrawer';
import {
  BLUE,
  GREEN,
  MAGENTA,
  RED,
  YELLOW,
  albedos,
  boxOf,
  drawn,
  renderUnderInstance,
  useParts,
  type UnresolvedPart,
} from './testing/drawerHost';

const BOX = new THREE.BoxGeometry(1, 1, 1);

const AT_1_2_3 = decomposeForR3F(parseTransform3D('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 2, 3)'));

function AtOnePlace({ parts, skeleton }: { parts: readonly UnresolvedPart[]; skeleton?: THREE.Skeleton }) {
  return <SurfacedMeshDrawer parts={useParts(parts)} skeleton={skeleton} />;
}

async function boxWith(materialId: string, properties: Parameters<typeof renderUnderInstance>[1] = {}) {
  return drawn(await renderUnderInstance(<AtOnePlace parts={[boxOf(BOX, materialId)]} />, properties));
}

describe('<SurfacedMeshDrawer> at one place', () => {
  it('draws each part once, the first as the body and each later one inside it', async () => {
    const dots = new THREE.BufferGeometry();
    dots.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    dots.userData = { godotDrawsPoints: true };
    function TwoParts() {
      const bodyRef = useRef<THREE.Mesh | null>(null);
      return (
        <SurfacedMeshDrawer
          parts={useParts([boxOf(BOX, 'Green'), boxOf(dots, 'Blue')])}
          body={{ ref: bodyRef, name: 'Body', transform: AT_1_2_3 }}
        >
          <group name="Subtree" />
        </SurfacedMeshDrawer>
      );
    }
    const renderer = await renderUnderInstance(<TwoParts />);

    const [body] = drawn(renderer);
    const [later] = drawn<THREE.Points>(renderer, 'Points');
    expect(body!.name).toBe('Body');
    expect(body!.position.toArray()).toEqual([1, 2, 3]);
    expect(body!.geometry).toBe(BOX);
    expect(albedos(body!)).toEqual([GREEN]);
    expect(later!.parent).toBe(body);
    expect(later!.geometry).toBe(dots);
    expect(albedos(later!)).toEqual([BLUE]);
    expect(body!.getObjectByName('Subtree')?.parent).toBe(body);
  });

  it('mounts the body and its children for a mesh with no part, which a loading mesh is', async () => {
    const renderer = await renderUnderInstance(
      <SurfacedMeshDrawer parts={[]} body={{ name: 'Body' }}>
        <group name="Subtree" />
      </SurfacedMeshDrawer>
    );

    const [body] = drawn(renderer);
    expect(body!.name).toBe('Body');
    expect(body!.getObjectByName('Subtree')?.parent).toBe(body);
  });

  it("carries the instance's shadow hooks and layers on every part", async () => {
    const renderer = await renderUnderInstance(
      <AtOnePlace parts={[boxOf(BOX, 'Green'), boxOf(new THREE.SphereGeometry(1), 'Blue')]} />,
      { layers: 2, castShadow: 0 }
    );

    for (const part of drawn(renderer)) {
      expect(part.userData).toMatchObject({ godotLayers: 2 });
      expect(part.castShadow).toBe(false);
      expect(part.receiveShadow).toBe(true);
    }
  });

  it('adds no draw for a material with no next_pass', async () => {
    expect(await boxWith('Green')).toHaveLength(1);
  });

  it('draws the geometry of the part a second time with the link material', async () => {
    const [own, link] = await boxWith('GreenThenBlue');

    expect(albedos(own!)).toEqual([GREEN]);
    expect(albedos(link!)).toEqual([BLUE]);
    // Not a second copy: Godot adds the surface it already has again.
    expect(link!.geometry).toBe(own!.geometry);
    expect(link!.renderOrder).toBe(nextPassRenderOrder(1));
  });

  it('draws a chain of three in link order, each after what it covers', async () => {
    const draws = await boxWith('GreenThenBlueThenYellow');

    expect(draws.map(albedos)).toEqual([[GREEN], [BLUE], [YELLOW]]);
    expect(draws.map((draw) => draw.renderOrder)).toEqual([
      0,
      nextPassRenderOrder(1),
      nextPassRenderOrder(2),
    ]);
  });

  it('draws material_override in place of the material of the part, with the chain of the override', async () => {
    const draws = await boxWith('GreenThenBlue', { materialOverride: 'SubResource("RedThenYellow")' });

    expect(draws.map(albedos)).toEqual([[RED], [YELLOW]]);
  });

  it('draws material_overlay one past the chain of the surface, and the chain of the overlay after it', async () => {
    const draws = await boxWith('GreenThenBlue', { materialOverlay: 'SubResource("ClearRedThenBlue")' });

    expect(draws.map(albedos)).toEqual([[GREEN], [BLUE], [RED], [BLUE]]);
    // The overlay is in the alpha pass, where a later draw of the instance draws first (`passOrder.ts`).
    expect(draws.slice(1).map((draw) => draw.renderOrder)).toEqual([
      nextPassRenderOrder(1),
      -nextPassRenderOrder(2),
      nextPassRenderOrder(3),
    ]);
    expect(draws[2]!.geometry).toBe(BOX);
  });

  it('draws each material of a hand-written cyclic chain once', async () => {
    const draws = await boxWith('OrangeThenMagenta');

    expect(draws).toHaveLength(2);
    expect(albedos(draws[1]!)).toEqual([MAGENTA]);
  });

  it('draws nothing for a link that reads the stencil, and the chain continues past it', async () => {
    // The canvas requests no stencil buffer. The link after the reader keeps its own ordinal.
    const draws = await boxWith('GreenThenStencilReader');

    expect(draws.map(albedos)).toEqual([[GREEN], [BLUE]]);
    expect(draws[1]!.renderOrder).toBe(nextPassRenderOrder(2));
  });

  it('ends the chain at a link that names no material', async () => {
    expect(await boxWith('GreenThenNothing')).toHaveLength(1);
  });

  it('skins a chain link by the skeleton that skins the body', async () => {
    const skeleton = new THREE.Skeleton([new THREE.Bone()]);
    const renderer = await renderUnderInstance(
      <AtOnePlace parts={[boxOf(BOX, 'GreenThenBlue')]} skeleton={skeleton} />
    );

    const [body, link] = drawn<THREE.SkinnedMesh>(renderer, 'SkinnedMesh');
    expect(body!.skeleton).toBe(skeleton);
    expect(link!.skeleton).toBe(skeleton);
    expect(albedos(link!)).toEqual([BLUE]);
  });

  it("carries the instance's layers to its extra draws, which decals and probes filter on", async () => {
    const draws = await boxWith('GreenThenBlue', {
      layers: 2,
      materialOverlay: 'SubResource("ClearRedThenBlue")',
    });

    expect(draws.map((draw) => draw.userData.godotLayers)).toEqual([2, 2, 2, 2]);
  });
});
