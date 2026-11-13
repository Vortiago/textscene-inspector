/**
 * The two ways an item gets its inherited CanvasItem state agree. A probe below every canvas item
 * reads what the drawn tree hands it (the nested scopes, and the y-sort lift where its parent was
 * lifted) and what the canvas item pass says its parent hands it.
 */
import { describe, expect, it } from 'vitest';
import { useContext, useMemo } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseTscnContent } from '../hooks/useParsedScene';
import { DispatchedScene } from '../testing/DispatchedScene';
import { settleLoads } from '../testing/settleLoads';
import { loaderServing } from '../../resources/testing/servingResourceLoader';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import { useNodePath } from '../contexts/NodePathContext';
import { useParentModulate } from '../canvasItemModulate';
import { useEffectiveZ } from '../lighting2d/canvasItemPlacement';
import { TextureSampler2DContext, type AmbientTextureSampler } from '../canvasItemTextureSampler';
import { projectCanvasTextureDefaults } from '../../parser/projectSettingsParser';
import { useCanvasAncestorMaterial } from '../components/canvasItemMaterialContext';
import { useLiveScenePass } from '../liveScenePass';
import { parentPathOf } from '../../utils/nodePath';
import { canvasItemPass } from './canvasItemPass';
import { INHERIT_PARENT_MATERIAL } from './canvasAncestors';
import '../nodes/index';

/** What one probe read: the drawn tree's state beside the pass's. */
interface Reading {
  drawn: unknown;
  pass: unknown;
}

/** A drawn item publishes its sampler with the viewport default laid in, where the pass leaves a gap. */
const VIEWPORT_DEFAULTS = projectCanvasTextureDefaults(null);

function withViewportDefaults({ filter, repeat }: AmbientTextureSampler): AmbientTextureSampler {
  return { filter: filter ?? VIEWPORT_DEFAULTS.filter, repeat: repeat ?? VIEWPORT_DEFAULTS.repeat };
}

/** By the probed parent's live path. Written only by `AgreementProbe`, and cleared by `readingsOf` before each mount. */
const readings = new Map<string, Reading>();

function AgreementProbe() {
  const path = useNodePath()!;
  const parent = parentPathOf(path)!;
  const inherited = useLiveScenePass(canvasItemPass, parent)?.inherited;
  const passMaterial = useCanvasAncestorMaterial(inherited?.material ?? INHERIT_PARENT_MATERIAL);
  const drawn = {
    modulate: useParentModulate(),
    zFinal: useEffectiveZ(),
    sampler: useContext(TextureSampler2DContext),
    material: useCanvasAncestorMaterial(INHERIT_PARENT_MATERIAL),
  };
  const pass = useMemo(
    () =>
      inherited && { ...inherited, sampler: withViewportDefaults(inherited.sampler), material: passMaterial },
    [inherited, passMaterial]
  );
  readings.set(parent, { drawn, pass });
  return null;
}

nodeComponentRegistry.register({ typeName: 'AgreementProbe', Component: AgreementProbe, container: true });

/** `body` with a probe below each canvas item it names in `probed`. */
async function readingsOf(
  body: string,
  probed: readonly string[],
  files: Record<string, string>
): Promise<Map<string, Reading>> {
  const probes = probed.map((parent) => `\n[node name="Probe" type="AgreementProbe" parent="${parent}"]\n`);
  const content = `[gd_scene format=3]\n\n${body}${probes.join('')}`;
  const { sceneGraph, error } = parseTscnContent(content, 'res://main.tscn');
  if (!sceneGraph) throw new Error(`expected a scene, got ${error}`);
  readings.clear();
  await ReactThreeTestRenderer.create(
    <DispatchedScene sceneGraph={sceneGraph} loader={loaderServing(files)} workspace="2d" />
  );
  await settleLoads();
  return new Map(readings);
}

/** Each probe's drawn state, with the pass's beside it, for one `expect`. */
function bothSides(found: ReadonlyMap<string, Reading>, probed: readonly string[]) {
  const readingOf = (parent: string) => found.get(`Root${parent === '.' ? '' : `/${parent}`}`);
  return {
    drawn: probed.map((parent) => ({ parent, state: readingOf(parent)?.drawn })),
    pass: probed.map((parent) => ({ parent, state: readingOf(parent)?.pass })),
  };
}

async function expectAgreement(body: string, probed: readonly string[], files: Record<string, string> = {}) {
  const { drawn, pass } = bothSides(await readingsOf(body, probed, files), probed);
  expect(drawn.every(({ state }) => state !== undefined)).toBe(true);
  expect(pass).toEqual(drawn);
}

const MATERIALS = `[sub_resource type="CanvasItemMaterial" id="Add"]
blend_mode = 1

`;

describe('the canvas item pass agrees with the drawn tree', () => {
  it('for a Node2D chain with mixed z_as_relative and a z sum past the clamp', async () => {
    await expectAgreement(
      `[node name="Root" type="Node2D"]
z_index = 3000
modulate = Color(0.5, 1, 1, 1)

[node name="Over" type="Node2D" parent="."]
z_index = 3000
modulate = Color(1, 0.5, 1, 1)

[node name="Absolute" type="Polygon2D" parent="Over"]
z_index = -2
z_as_relative = false

[node name="Relative" type="Node2D" parent="Over/Absolute"]
z_index = 5
`,
      ['.', 'Over', 'Over/Absolute', 'Over/Absolute/Relative']
    );
  });

  it('for a use_parent_material chain of three', async () => {
    await expectAgreement(
      `${MATERIALS}[node name="Root" type="Node2D"]
material = SubResource("Add")

[node name="A" type="Node2D" parent="."]
use_parent_material = true

[node name="B" type="Sprite2D" parent="A"]
use_parent_material = true

[node name="C" type="Node2D" parent="A/B"]
use_parent_material = true
`,
      ['A', 'A/B', 'A/B/C']
    );
  });

  it('for a sampler chain with a PARENT_NODE link in the middle', async () => {
    await expectAgreement(
      `[node name="Root" type="Node2D"]
texture_filter = 1
texture_repeat = 2

[node name="Middle" type="Node2D" parent="."]

[node name="Own" type="Node2D" parent="Middle"]
texture_filter = 4
`,
      ['Middle', 'Middle/Own']
    );
  });

  it('for a top_level Node2D below a tinted Node2D', async () => {
    await expectAgreement(
      `[node name="Root" type="Node2D"]

[node name="Tinted" type="Node2D" parent="."]
position = Vector2(300, 200)
modulate = Color(0.2, 0.4, 0.9, 1)
z_index = 5

[node name="Top" type="Node2D" parent="Tinted"]
top_level = true
position = Vector2(50, 60)
`,
      ['Tinted', 'Tinted/Top']
    );
  });

  it('for a Node2D below a CanvasLayer inside a Node2D subtree', async () => {
    await expectAgreement(
      `[node name="Root" type="Node2D"]
modulate = Color(0.5, 0.5, 0.5, 1)
z_index = 4

[node name="Layer" type="CanvasLayer" parent="."]

[node name="Item" type="Node2D" parent="Layer"]
modulate = Color(0.2, 0.4, 0.9, 1)
`,
      ['Layer/Item']
    );
  });

  it('for a lifted Node2D chain in a y-sorted subtree', async () => {
    await expectAgreement(
      `[node name="Root" type="Node2D"]
y_sort_enabled = true
modulate = Color(0.5, 1, 1, 1)

[node name="Outer" type="Node2D" parent="."]
y_sort_enabled = true
modulate = Color(1, 0.5, 1, 1)
z_index = 2
texture_filter = 1

[node name="Inner" type="Node2D" parent="Outer"]
y_sort_enabled = true
position = Vector2(10, 40)
z_index = 1
`,
      ['Outer', 'Outer/Inner']
    );
  });

  it('for a Node2D between two Controls', async () => {
    await expectAgreement(
      `[node name="Root" type="Control"]
modulate = Color(0.5, 1, 1, 1)
z_index = 2

[node name="Mid" type="Node2D" parent="."]
z_index = 1
modulate = Color(1, 0.5, 1, 1)

[node name="Leaf" type="ColorRect" parent="Mid"]
offset_right = 10.0
offset_bottom = 10.0
`,
      ['Mid']
    );
  });

  it('for two instances of one sub-scene with a different modulate on each instance root', async () => {
    await expectAgreement(
      `[ext_resource type="PackedScene" path="res://body.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Red" parent="." instance=ExtResource("1")]
modulate = Color(1, 0, 0, 1)

[node name="Blue" parent="." instance=ExtResource("1")]
modulate = Color(0, 0, 1, 1)
z_index = 3
`,
      ['Red/Leaf', 'Blue/Leaf'],
      {
        'res://body.tscn': `[gd_scene format=3]

[node name="Body" type="Node2D"]

[node name="Leaf" type="Node2D" parent="."]
modulate = Color(0.5, 0.5, 0.5, 1)
`,
      }
    );
  });

  it('for a Control with z_index, modulate and texture_filter as a lifted link', async () => {
    await expectAgreement(
      `[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Link" type="Control" parent="."]
y_sort_enabled = true
modulate = Color(0.2, 0.4, 0.9, 1)
z_index = 3
texture_filter = 1
offset_left = 300.0
offset_top = 200.0
offset_right = 340.0
offset_bottom = 240.0

[node name="Child" type="Node2D" parent="Link"]
position = Vector2(20, 20)
`,
      ['Link/Child']
    );
  });
});
