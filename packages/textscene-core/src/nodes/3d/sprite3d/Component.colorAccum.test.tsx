/**
 * `SpriteBase3D::_get_color_accum()` (`sprite_3d.cpp:36-52`): a sprite's drawn
 * colour is its parent's accumulated colour × its own modulate, r/g/b AND a,
 * consumed as the vertex colour at `:124`.
 *
 * The accumulation walks the IMMEDIATE parent only — `parent_sprite` is
 * `Object::cast_to<SpriteBase3D>(get_parent())` (`:75`) — so one intervening
 * node restarts it at white. Label3D is not in the family: it derives from
 * GeometryInstance3D (`label_3d.h:38`) as SpriteBase3D does (`sprite_3d.h:36`),
 * making them siblings, not ancestor and descendant.
 *
 * Rendered through the dispatcher because the rule is about what a node's
 * PARENT is, which a directly-mounted component cannot express.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { SelectionProvider } from '../../../r3f/contexts/SelectionContext';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { parseSprite3D } from './parser';
import { parseLabel3D } from '../label3d/parser';
import { parseNode3D } from '../../base/node3d/parser';
import '../../../r3f/nodes/index';

const TEXTURE_PATH = 'res://sprite.png';

/** Independent of the renderer's own conversion — the sRGB EOTF as specced. */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function sprite(name: string, raw: Record<string, string>, children: TscnNode[] = []): TscnNode {
  return {
    name,
    type: 'Sprite3D',
    children,
    properties: parseSprite3D(
      { type: 'node', attributes: { type: 'Sprite3D', name } },
      { texture: 'ExtResource("1")', ...raw }
    ),
  };
}

function plainNode3D(name: string, children: TscnNode[]): TscnNode {
  return {
    name,
    type: 'Node3D',
    children,
    properties: parseNode3D({ type: 'node', attributes: { type: 'Node3D', name } }, {}),
  };
}

function label(name: string, children: TscnNode[]): TscnNode {
  return {
    name,
    type: 'Label3D',
    children,
    properties: parseLabel3D(
      { type: 'node', attributes: { type: 'Label3D', name } },
      { text: '"x"' }
    ),
  };
}

async function render(nodes: TscnNode[]) {
  const fake = createFakeResourceLoader();
  const tex = new THREE.Texture();
  (tex as unknown as { image: { width: number; height: number } }).image = { width: 8, height: 8 };
  fake.textures.seed(TEXTURE_PATH, tex);
  return ReactThreeTestRenderer.create(
    <SelectionProvider>
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={[]}
          externalResources={[{ id: '1', type: 'Texture2D', path: TEXTURE_PATH }]}
        >
          <NodeDispatcher nodes={nodes} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </SelectionProvider>
  );
}

function materialOf(
  renderer: Awaited<ReturnType<typeof render>>,
  name: string
): THREE.MeshBasicMaterial {
  const mesh = renderer.scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => m.name === name);
  if (!mesh) throw new Error(`no mesh named ${name}`);
  return mesh.material as THREE.MeshBasicMaterial;
}

// Half in red and half in alpha at every level: the product differs from both
// factors, and 0.5 × 0.5 in sRGB (→ 0.0509 linear) is distinguishable from the
// same pair converted first and multiplied after (→ 0.0458).
const HALF = 'Color(0.5, 1, 1, 0.5)';

describe('SpriteBase3D colour accumulation', () => {
  it('multiplies a sprite by its parent sprite, r/g/b and a', async () => {
    const renderer = await render([
      sprite('Parent', { modulate: HALF }, [sprite('Child', { modulate: HALF })]),
    ]);

    const parent = materialOf(renderer, 'Parent');
    expect(parent.color.r).toBeCloseTo(srgbToLinear(0.5), 5);
    expect(parent.opacity).toBeCloseTo(0.5, 5);

    const child = materialOf(renderer, 'Child');
    expect(child.color.r).toBeCloseTo(srgbToLinear(0.25), 5);
    expect(child.color.g).toBeCloseTo(1, 5);
    expect(child.opacity).toBeCloseTo(0.25, 5);
  });

  it('restarts at white when a plain Node3D sits between two sprites', async () => {
    // `sprite_3d.cpp:75` casts the IMMEDIATE parent; a Node3D fails the cast,
    // so the grandchild has no `parent_sprite` and accumulates from white.
    const renderer = await render([
      sprite('Parent', { modulate: HALF }, [
        plainNode3D('Between', [sprite('Child', { modulate: HALF })]),
      ]),
    ]);

    const child = materialOf(renderer, 'Child');
    expect(child.color.r).toBeCloseTo(srgbToLinear(0.5), 5);
    expect(child.opacity).toBeCloseTo(0.5, 5);
  });

  it('restarts at white when a Label3D sits between two sprites', async () => {
    // Label3D derives from GeometryInstance3D (`label_3d.h:38`), as SpriteBase3D
    // does (`sprite_3d.h:36`) — siblings, so the cast fails here too. It carries
    // a `modulate` of its own, which makes it the tempting wrong answer.
    const renderer = await render([
      sprite('Parent', { modulate: HALF }, [
        label('Between', [sprite('Child', { modulate: HALF })]),
      ]),
    ]);

    const child = materialOf(renderer, 'Child');
    expect(child.color.r).toBeCloseTo(srgbToLinear(0.5), 5);
    expect(child.opacity).toBeCloseTo(0.5, 5);
  });

  it('accumulates through three sprite levels', async () => {
    const renderer = await render([
      sprite('A', { modulate: HALF }, [
        sprite('B', { modulate: HALF }, [sprite('C', { modulate: HALF })]),
      ]),
    ]);

    const c = materialOf(renderer, 'C');
    expect(c.color.r).toBeCloseTo(srgbToLinear(0.125), 5);
    expect(c.opacity).toBeCloseTo(0.125, 5);
  });

  it('does not pass the parent\'s transparency down', async () => {
    // `_get_color_accum` reads `modulate` only; `transparency` is a
    // per-instance GeometryInstance3D property the renderer applies locally.
    const renderer = await render([
      sprite('Parent', { modulate: 'Color(1, 1, 1, 1)', transparency: '0.5' }, [
        sprite('Child', { modulate: 'Color(1, 1, 1, 1)' }),
      ]),
    ]);

    expect(materialOf(renderer, 'Parent').opacity).toBeCloseTo(0.5, 5);
    expect(materialOf(renderer, 'Child').opacity).toBeCloseTo(1, 5);
  });
});
