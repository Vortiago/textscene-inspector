/**
 * Which owner's `%Name` table a rendered node resolves against, and what that table
 * holds once instanced content is composed in. `packed_scene.cpp:565-570` acquires a
 * sub-scene's names before the outer file's override properties land (:492), so the
 * sub-scene's claimants come first.
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser.js';
import type { TscnScene } from '../parser/types.js';
import type { LiveTreeContext } from './liveSceneTree.js';
import { claimOwnerOf, localSceneUniquePaths, localSceneOf, ownerUniquePaths } from './uniqueNameOwner.js';
import { synthesiseGLBScene } from '../resources/processors/createSceneProcessor.js';
import * as THREE from 'three';

const main = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://hud.tscn" id="1"]
[ext_resource type="PackedScene" path="res://inner.tscn" id="2"]

[node name="Root" type="Node2D"]

[node name="HudInstance" parent="." instance=ExtResource("1")]

[node name="Hit" parent="HudInstance/Panel"]
unique_name_in_owner = true

[node name="Extra" type="Node2D" parent="HudInstance"]
unique_name_in_owner = true

[node name="Inner" parent="HudInstance" instance=ExtResource("2")]

[node name="Gear" parent="HudInstance/Inner"]
unique_name_in_owner = true

[node name="Screen" type="Sprite2D" parent="."]
`);

const hud = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://widget.tscn" id="1"]

[node name="Hud" type="Node2D"]
unique_name_in_owner = true

[node name="Panel" type="Node2D" parent="."]
unique_name_in_owner = true

[node name="Hit" type="Node2D" parent="Panel"]

[node name="Widget" parent="." instance=ExtResource("1")]

[node name="Knob" parent="Widget"]
unique_name_in_owner = true

[node name="Sprite" type="Sprite2D" parent="."]
`);

const widget = new TscnParser().parse(`[gd_scene format=3]

[node name="Widget" type="Node2D"]

[node name="Knob" type="Node2D" parent="."]

[node name="Face" type="Sprite2D" parent="."]
`);

const inner = new TscnParser().parse(`[gd_scene format=3]

[node name="Inner" type="Node2D"]

[node name="Gear" type="Node2D" parent="."]

[node name="Face" type="Sprite2D" parent="."]
`);

const scenes = new Map<string, TscnScene>([
  ['res://hud.tscn', hud],
  ['res://widget.tscn', widget],
  ['res://inner.tscn', inner],
]);
const ctx: LiveTreeContext = {
  externalResources: main.externalResources,
  internalResources: [],
  sceneCache: { getCached: (p) => scenes.get(p) },
};

const ownerOf = (path: string) => claimOwnerOf(path, main.nodes, ctx);

describe('claimOwnerOf', () => {
  it('owns an outer node by the outer root', () => {
    const owner = ownerOf('Root/Screen');
    expect(owner.parent).toBeUndefined();
    expect(owner.roots).toBe(main.nodes);
  });

  it('owns a node inside an instance by the instance it collapsed into', () => {
    const owner = ownerOf('Root/HudInstance/Sprite');
    expect(owner.path).toBe('Root/HudInstance');
    expect(owner.roots).toBe(hud.nodes);
    expect(owner.parent?.roots).toBe(main.nodes);
  });

  it('owns the instance node itself by the file its heading is in', () => {
    expect(ownerOf('Root/HudInstance').parent).toBeUndefined();
  });

  it('owns a node ADDED under the instance by the outer root (resource_format_text.cpp:264-265)', () => {
    expect(ownerOf('Root/HudInstance/Extra').parent).toBeUndefined();
  });

  it('owns an OVERRIDE under the instance by the sub-scene root (resource_format_text.cpp:264-265)', () => {
    expect(ownerOf('Root/HudInstance/Panel/Hit').path).toBe('Root/HudInstance');
  });

  it('nests: a node inside an instance inside an instance', () => {
    const owner = ownerOf('Root/HudInstance/Widget/Face');
    expect(owner.path).toBe('Root/HudInstance/Widget');
    expect(owner.roots).toBe(widget.nodes);
    expect(owner.parent?.path).toBe('Root/HudInstance');
  });

  it('falls back to the outer root while the sub-scene has not loaded', () => {
    const unloaded: LiveTreeContext = { ...ctx, sceneCache: { getCached: () => undefined } };
    expect(claimOwnerOf('Root/HudInstance/Sprite', main.nodes, unloaded).parent).toBeUndefined();
  });
});

/**
 * `make_local_resource` sets a local-to-scene resource up against the node itself when it is its
 * scene's root or an instance, else against its owner (packed_scene.cpp:707).
 */
describe('localSceneOf', () => {
  const localRoot = (path: string) => localSceneOf(path, main.nodes, ctx).path;

  it('is the outer root for an outer node', () => {
    expect(localRoot('Root/Screen')).toBe('Root');
  });

  it('is the outer root for the outer root itself', () => {
    expect(localRoot('Root')).toBe('Root');
  });

  it('is the instance for a node inside it', () => {
    expect(localRoot('Root/HudInstance/Sprite')).toBe('Root/HudInstance');
  });

  it('is the instance node itself, not the file its heading is in', () => {
    expect(localRoot('Root/HudInstance')).toBe('Root/HudInstance');
  });

  it('is the instance for an override heading inside it', () => {
    expect(localRoot('Root/HudInstance/Panel/Hit')).toBe('Root/HudInstance');
  });

  it('is the outer root for a node the outer file adds under the instance', () => {
    expect(localRoot('Root/HudInstance/Extra')).toBe('Root');
  });

  it('is the innermost instance for a node inside nested instances', () => {
    expect(localRoot('Root/HudInstance/Widget/Face')).toBe('Root/HudInstance/Widget');
  });
});

/**
 * A `.glb` instance is one node in Godot, its own local scene, whose imported nodes it owns. This
 * tree renders the GLB root one segment below the instance node.
 */
describe('localSceneOf a GLB instance', () => {
  const host = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://model.glb" id="1"]

[node name="Root" type="Node3D"]

[node name="Model" parent="." instance=ExtResource("1")]

[node name="Viewport" type="SubViewport" parent="Model"]
`);
  const glb = new THREE.Group();
  const body = new THREE.Mesh();
  body.name = 'body';
  glb.add(body);
  const glbScene = synthesiseGLBScene('res://model.glb');
  const glbCtx: LiveTreeContext = {
    externalResources: host.externalResources,
    internalResources: [],
    sceneCache: { getCached: (p) => (p === 'res://model.glb' ? glbScene : undefined) },
    glbCache: { getCached: (p) => (p === 'res://model.glb' ? glb : undefined) },
  };
  const localRoot = (path: string) => localSceneOf(path, host.nodes, glbCtx).path;

  it('is the instance node for the GLB root', () => {
    expect(localRoot('Root/Model/model')).toBe('Root/Model');
  });

  it('is the instance node for a node inside the GLB', () => {
    expect(localRoot('Root/Model/model/body')).toBe('Root/Model');
  });

  it('is the outer root for a node the outer file adds under the GLB instance (edge case)', () => {
    expect(localRoot('Root/Model/Viewport')).toBe('Root');
  });

  it('reads an empty claim table for a node inside the GLB', () => {
    expect(localSceneUniquePaths(localSceneOf('Root/Model/model/body', host.nodes, glbCtx)).size).toBe(0);
  });

  it('reads an empty claim table for the owner of a node inside the GLB', () => {
    expect(ownerUniquePaths(claimOwnerOf('Root/Model/model/body', host.nodes, glbCtx)).size).toBe(0);
  });
});

/** `get_node` from the local scene root reads its own table, else its owner's (node.cpp:1930-1938). */
describe('localSceneUniquePaths', () => {
  const claimsFrom = (path: string) => localSceneUniquePaths(localSceneOf(path, main.nodes, ctx));

  it('is the shared outer table for the outer root', () => {
    expect(claimsFrom('Root/Screen')).toBe(ownerUniquePaths(ownerOf('Root/Screen')));
  });

  it('reads an instance root\u2019s own claims', () => {
    expect(claimsFrom('Root/HudInstance/Sprite').get('%Panel')).toBe('Root/HudInstance/Panel');
  });

  it('falls back to the table of the instance\u2019s owner', () => {
    expect(claimsFrom('Root/HudInstance/Sprite').get('%Extra')).toBe('Root/HudInstance/Extra');
  });

  it('stops at the owner: a nested instance does not reach the outer table', () => {
    const table = claimsFrom('Root/HudInstance/Widget/Face');
    expect(table.get('%Panel')).toBe('Root/HudInstance/Panel');
    expect(table.has('%Extra')).toBe(false);
  });
});

describe('ownerUniquePaths', () => {
  it('is the shared outer table for the outer root', () => {
    const table = ownerUniquePaths(ownerOf('Root/Screen'));
    expect(table.get('%Extra')).toBe('Root/HudInstance/Extra');
    expect(table.has('%Panel')).toBe(false);
    expect(ownerUniquePaths(ownerOf('Root/Screen'))).toBe(table);
  });

  it('spells a sub-scene claim at its composed live path', () => {
    const table = ownerUniquePaths(ownerOf('Root/HudInstance/Sprite'));
    expect(table.get('%Panel')).toBe('Root/HudInstance/Panel');
  });

  it('never claims the sub-scene root itself (packed_scene.cpp:565 acquires only for owner >= 0)', () => {
    expect(ownerUniquePaths(ownerOf('Root/HudInstance/Sprite')).has('%Hud')).toBe(false);
  });

  it('folds in the outer file override that the sub-scene root owns', () => {
    const table = ownerUniquePaths(ownerOf('Root/HudInstance/Sprite'));
    expect(table.get('%Hit')).toBe('Root/HudInstance/Panel/Hit');
  });

  it('leaves the outer root claim of an added node out of the sub-scene table', () => {
    expect(ownerUniquePaths(ownerOf('Root/HudInstance/Sprite')).has('%Extra')).toBe(false);
  });

  it('folds a nested override in from the file that instanced the inner scene', () => {
    const table = ownerUniquePaths(ownerOf('Root/HudInstance/Widget/Face'));
    expect(table.get('%Knob')).toBe('Root/HudInstance/Widget/Knob');
    expect(table.has('%Panel')).toBe(false);
  });

  it('files an override under the instance the outer file ADDED inside another, not the outer instance', () => {
    const owner = ownerOf('Root/HudInstance/Inner/Face');
    expect(owner.path).toBe('Root/HudInstance/Inner');
    expect(owner.parent?.parent).toBeUndefined();
    expect(ownerUniquePaths(owner).get('%Gear')).toBe('Root/HudInstance/Inner/Gear');
    expect(ownerUniquePaths(ownerOf('Root/HudInstance/Sprite')).has('%Gear')).toBe(false);
  });
});

describe('ownership the outer file cannot see', () => {
  // hud.tscn instances `Widget`, so an override inside it keeps Widget as owner
  // (resource_format_text.cpp:264-265) and `%Face` registers on Widget's table
  // (node.cpp:2222-2234). A consumer inside Widget resolves it, one directly under
  // the HUD instance does not (node.cpp:1930-1938).
  const nested = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://hud.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="HudInstance" parent="." instance=ExtResource("1")]

[node name="Face" parent="HudInstance/Widget"]
unique_name_in_owner = true

[node name="Lamp" type="Node2D" parent="." owner="HudInstance"]
`);
  const nestedCtx: LiveTreeContext = { ...ctx, externalResources: nested.externalResources };
  const own = (path: string) => claimOwnerOf(path, nested.nodes, nestedCtx);

  it('files an override inside a sub-scene\u2019s own nested instance under that inner instance', () => {
    expect(ownerUniquePaths(own('Root/HudInstance/Widget/Knob')).get('%Face')).toBe(
      'Root/HudInstance/Widget/Face'
    );
    expect(ownerUniquePaths(own('Root/HudInstance/Sprite')).has('%Face')).toBe(false);
    expect(ownerUniquePaths(own('Root/Lamp')).has('%Face')).toBe(false);
  });

  /** A new node's properties land (packed_scene.cpp:438) before its owner is set (:566-568). */
  it('measures a local scene from the file root, not an explicit owner=', () => {
    expect(localSceneOf('Root/Lamp', nested.nodes, nestedCtx).path).toBe('Root');
  });

  it('gives a consumer with an explicit owner= that owner\u2019s table', () => {
    const owner = own('Root/Lamp');
    expect(owner.path).toBe('Root/HudInstance');
    expect(ownerUniquePaths(owner).has('%Panel')).toBe(true);
  });
});

describe('an override that clears unique_name_in_owner', () => {
  // The override's property lands after the sub-scene acquires its names, and a clear releases
  // the node's own name (node.cpp:2236-2249).
  const releasing = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://hud.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="HudInstance" parent="." instance=ExtResource("1")]

[node name="Panel" parent="HudInstance"]
unique_name_in_owner = false
`);
  const releasingCtx: LiveTreeContext = { ...ctx, externalResources: releasing.externalResources };

  it('drops the name from the instance table', () => {
    const owner = claimOwnerOf('Root/HudInstance/Sprite', releasing.nodes, releasingCtx);
    expect(ownerUniquePaths(owner).has('%Panel')).toBe(false);
  });
});

describe('a node its file seats through an instanced %Name', () => {
  // `parent="HudInstance/%Panel"` reads the instance's own table (node.cpp:1930-1933), so Hat
  // renders under the sub-scene's Panel, which its own file cannot spell.
  const through = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://hud.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="HudInstance" parent="." instance=ExtResource("1")]

[node name="Hat" type="Node2D" parent="HudInstance/%Panel"]
unique_name_in_owner = true

[node name="Brim" type="Node2D" parent="HudInstance/%Panel/Hat"]
unique_name_in_owner = true
`);
  const throughCtx: LiveTreeContext = { ...ctx, externalResources: through.externalResources };
  const ownerAt = (path: string) => claimOwnerOf(path, through.nodes, throughCtx);

  it('spells its claim at the composed path it renders at', () => {
    expect(ownerUniquePaths(ownerAt('Root')).get('%Hat')).toBe('Root/HudInstance/Panel/Hat');
  });

  it('spells a claim below it at the composed path too', () => {
    expect(ownerUniquePaths(ownerAt('Root')).get('%Brim')).toBe('Root/HudInstance/Panel/Hat/Brim');
  });

  it('is owned by the file that wrote it, not the instance it renders inside', () => {
    expect(ownerAt('Root/HudInstance/Panel/Hat').path).toBe('Root');
  });
});

describe('a claim under an instanced %Name a later heading releases', () => {
  // Instantiate sets each heading's properties as it reaches it (packed_scene.cpp:157-165), so
  // Hat's `parent=` reads `%Panel` before the release below it lands (node.cpp:2236-2249).
  const releasingLater = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://hud.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="HudInstance" parent="." instance=ExtResource("1")]

[node name="Hat" type="Node2D" parent="HudInstance/%Panel"]
unique_name_in_owner = true

[node name="Panel" parent="HudInstance"]
unique_name_in_owner = false
`);
  const releasingCtx: LiveTreeContext = { ...ctx, externalResources: releasingLater.externalResources };

  it('spells the claim at the node the heading reached', () => {
    const owner = claimOwnerOf('Root', releasingLater.nodes, releasingCtx);
    expect(ownerUniquePaths(owner).get('%Hat')).toBe('Root/HudInstance/Panel/Hat');
  });
});

describe('an instance of an inherited scene', () => {
  // The inherited root is the base scene's instance (packed_scene.cpp:227-231), so it owns the
  // base's nodes and their names (packed_scene.cpp:565-570).
  const base = new TscnParser().parse(`[gd_scene format=3]

[node name="Base" type="Node2D"]

[node name="Grip" type="Node2D" parent="."]
unique_name_in_owner = true
`);
  const inheriting = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://base.tscn" id="1"]

[node name="Tool" instance=ExtResource("1")]

[node name="Blade" type="Node2D" parent="."]
unique_name_in_owner = true
`);
  const host = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://tool.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Tool" parent="." instance=ExtResource("1")]
`);
  const inheritedScenes = new Map<string, TscnScene>([
    ['res://base.tscn', base],
    ['res://tool.tscn', inheriting],
  ]);
  const inheritedCtx: LiveTreeContext = {
    externalResources: host.externalResources,
    internalResources: [],
    sceneCache: { getCached: (p) => inheritedScenes.get(p) },
  };
  const table = () => ownerUniquePaths(claimOwnerOf('Root/Tool/Blade', host.nodes, inheritedCtx));

  it('holds the base scene’s claims', () => {
    expect(table().get('%Grip')).toBe('Root/Tool/Grip');
  });

  it('holds the inherited scene’s own claims', () => {
    expect(table().get('%Blade')).toBe('Root/Tool/Blade');
  });

  it('holds the base scene’s claims for the inherited scene opened on its own', () => {
    const ownCtx: LiveTreeContext = { ...inheritedCtx, externalResources: inheriting.externalResources };
    expect(ownerUniquePaths(claimOwnerOf('Tool', inheriting.nodes, ownCtx)).get('%Grip')).toBe('Tool/Grip');
  });
});

describe('a node outside an instance whose owner= names that instance', () => {
  // The loader sets the owner from the NodePath (resource_format_text.cpp:257-262), and
  // instantiate registers the name on that owner (packed_scene.cpp:565-570).
  const lent = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://hud.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="HudInstance" parent="." instance=ExtResource("1")]

[node name="Lamp" type="Node2D" parent="." owner="HudInstance"]
unique_name_in_owner = true
`);
  const lentCtx: LiveTreeContext = { ...ctx, externalResources: lent.externalResources };
  const pathsAt = (path: string) => ownerUniquePaths(claimOwnerOf(path, lent.nodes, lentCtx));

  it('registers its name on the instance table', () => {
    expect(pathsAt('Root/HudInstance/Sprite').get('%Lamp')).toBe('Root/Lamp');
  });

  it('leaves its name out of the outer table', () => {
    expect(pathsAt('Root').has('%Lamp')).toBe(false);
  });
});

describe('a node outside a nested instance whose owner= names it with no heading of its own', () => {
  // The owner NodePath resolves from the root with get_node_or_null (packed_scene.cpp:159-161),
  // so it reaches the nested instance HudInstance's sub-scene seats.
  const lentToWidget = (lampParent: string) =>
    new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://hud.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="HudInstance" parent="." instance=ExtResource("1")]

[node name="Lamp" type="Node2D" parent="${lampParent}" owner="HudInstance/Widget"]
unique_name_in_owner = true
`);
  const widgetPaths = (scene: TscnScene) =>
    ownerUniquePaths(
      claimOwnerOf('Root/HudInstance/Widget/Face', scene.nodes, {
        ...ctx,
        externalResources: scene.externalResources,
      })
    );

  it('registers the name of a node inside the outer instance on the nested one', () => {
    expect(widgetPaths(lentToWidget('HudInstance')).get('%Lamp')).toBe('Root/HudInstance/Lamp');
  });

  it('registers the name of a node outside both instances on the nested one', () => {
    expect(widgetPaths(lentToWidget('.')).get('%Lamp')).toBe('Root/Lamp');
  });
});

describe('a node inside one instance whose owner= names a sibling instance', () => {
  const lentAcross = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://hud.tscn" id="1"]
[ext_resource type="PackedScene" path="res://inner.tscn" id="2"]

[node name="Root" type="Node2D"]

[node name="HudInstance" parent="." instance=ExtResource("1")]

[node name="InnerInstance" parent="." instance=ExtResource("2")]

[node name="Lamp" type="Node2D" parent="HudInstance" owner="InnerInstance"]
unique_name_in_owner = true
`);
  const acrossCtx: LiveTreeContext = { ...ctx, externalResources: lentAcross.externalResources };
  const pathsAt = (path: string) => ownerUniquePaths(claimOwnerOf(path, lentAcross.nodes, acrossCtx));

  it('registers its name on the instance its owner= names', () => {
    expect(pathsAt('Root/InnerInstance/Face').get('%Lamp')).toBe('Root/HudInstance/Lamp');
  });

  it('leaves its name out of the instance it sits in', () => {
    expect(pathsAt('Root/HudInstance/Sprite').has('%Lamp')).toBe(false);
  });
});

describe('an owner= spelt through a %Name', () => {
  // Instantiate resolves the owner NodePath from the root with get_node_or_null
  // (packed_scene.cpp:159-161), so a `%Name` in it reads the tables as of the heading.
  const hudClaimingWidget = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://widget.tscn" id="1"]

[node name="Hud" type="Node2D"]

[node name="Widget" parent="." instance=ExtResource("1")]
unique_name_in_owner = true

[node name="Sprite" type="Sprite2D" parent="."]
`);
  const parsed = (lamp: string) =>
    new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://hud.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="HudInstance" parent="." instance=ExtResource("1")]
unique_name_in_owner = true

${lamp}
unique_name_in_owner = true
`);
  const ownerAt = (scene: TscnScene, path: string) =>
    claimOwnerOf(path, scene.nodes, {
      ...ctx,
      externalResources: scene.externalResources,
      sceneCache: { getCached: (p) => (p === 'res://hud.tscn' ? hudClaimingWidget : scenes.get(p)) },
    });

  it('registers the name on the instance the root table names', () => {
    const scene = parsed('[node name="Lamp" type="Node2D" parent="." owner="%HudInstance"]');
    expect(ownerUniquePaths(ownerAt(scene, 'Root/HudInstance/Sprite')).get('%Lamp')).toBe('Root/Lamp');
  });

  it('registers the name on the instance a sub-scene table names', () => {
    const scene = parsed('[node name="Lamp" type="Node2D" parent="HudInstance" owner="HudInstance/%Widget"]');
    expect(ownerUniquePaths(ownerAt(scene, 'Root/HudInstance/Widget/Face')).get('%Lamp')).toBe(
      'Root/HudInstance/Lamp'
    );
  });

  it('owns the node by the instance a sub-scene table names', () => {
    const scene = parsed('[node name="Lamp" type="Node2D" parent="HudInstance" owner="HudInstance/%Widget"]');
    expect(ownerAt(scene, 'Root/HudInstance/Lamp').path).toBe('Root/HudInstance/Widget');
  });
});

describe('an owner= on a sub-scene heading that the host overrides', () => {
  // The fold keeps the sub-scene node's own fields, so the owner= is the sub-scene heading's.
  const hudGivingLampToWidget = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://widget.tscn" id="1"]

[node name="Hud" type="Node2D"]

[node name="Widget" parent="." instance=ExtResource("1")]

[node name="Lamp" type="Node2D" parent="." owner="Widget"]
unique_name_in_owner = true
`);
  const host = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://hud.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="HudInstance" parent="." instance=ExtResource("1")]

[node name="Lamp" parent="HudInstance"]
visible = false
`);

  it('walks the owner from the root of the file that adds the node', () => {
    const owner = claimOwnerOf('Root/HudInstance/Lamp', host.nodes, {
      ...ctx,
      externalResources: host.externalResources,
      sceneCache: { getCached: (p) => (p === 'res://hud.tscn' ? hudGivingLampToWidget : scenes.get(p)) },
    });
    expect(owner.path).toBe('Root/HudInstance/Widget');
  });
});

describe('an owner= that names no node when instantiate sets it', () => {
  // An owner path get_node_or_null misses sets no owner (packed_scene.cpp:159-168, :565-570),
  // and a walk from a node with no owner reads no table but its own (node.cpp:1930-1938).
  const ownerless = (lampOwner: string, after = '') =>
    new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://hud.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="HudInstance" parent="." instance=ExtResource("1")]

[node name="Lamp" type="Node2D" parent="." owner="${lampOwner}"]
unique_name_in_owner = true
${after}`);
  const lampTable = (scene: TscnScene) =>
    ownerUniquePaths(
      claimOwnerOf('Root/Lamp', scene.nodes, { ...ctx, externalResources: scene.externalResources })
    );

  it('reads no table for an owner declared after the heading', () => {
    const scene = ownerless('Later', '\n[node name="Later" parent="." instance=ExtResource("1")]\n');
    expect(lampTable(scene).size).toBe(0);
  });

  it('reads no table for an owner that climbs above the root', () => {
    const scene = ownerless(
      'HudInstance/%Panel/../../..',
      '\n[node name="Screen" type="Node2D" parent="."]\nunique_name_in_owner = true\n'
    );
    expect(lampTable(scene).size).toBe(0);
  });
});

describe('an inherited scene whose owner= names a base %Name', () => {
  // An inherited root owns its base's nodes and their names (packed_scene.cpp:227-231).
  const base = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://widget.tscn" id="1"]

[node name="Base" type="Node2D"]

[node name="A" parent="." instance=ExtResource("1")]
unique_name_in_owner = true
`);
  const inherited = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://base.tscn" id="1"]

[node name="Player" instance=ExtResource("1")]

[node name="Lamp" type="Node2D" parent="." owner="%A"]
unique_name_in_owner = true
`);
  const inheritedCtx: LiveTreeContext = {
    ...ctx,
    externalResources: inherited.externalResources,
    sceneCache: { getCached: (p) => (p === 'res://base.tscn' ? base : scenes.get(p)) },
  };

  it('registers the name on the base instance the %Name names', () => {
    const owner = claimOwnerOf('Player/A/Face', inherited.nodes, inheritedCtx);
    expect(ownerUniquePaths(owner).get('%Lamp')).toBe('Player/Lamp');
  });
});

describe('an owner= recovered through its owner_uid_path', () => {
  // A missed owner path falls back to the id trail (packed_scene.cpp:159-163, :1947).
  const recovered = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://hud.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="HudInstance" parent="." instance=ExtResource("1") unique_id=77]

[node name="Lamp" type="Node2D" parent="." owner="Gone" owner_uid_path=PackedInt32Array(77)]
unique_name_in_owner = true
`);
  const recoveredCtx: LiveTreeContext = { ...ctx, externalResources: recovered.externalResources };

  it('registers the name on the instance the trail finds', () => {
    const owner = claimOwnerOf('Root/HudInstance/Sprite', recovered.nodes, recoveredCtx);
    expect(ownerUniquePaths(owner).get('%Lamp')).toBe('Root/Lamp');
  });
});

describe('the walk an owner= with a %Name takes', () => {
  const hudClaimingWidget = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://widget.tscn" id="1"]

[node name="Hud" type="Node2D"]

[node name="Widget" parent="." instance=ExtResource("1")]
unique_name_in_owner = true
`);
  const lent = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://hud.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="HudInstance" parent="." instance=ExtResource("1")]

[node name="Lamp" type="Node2D" parent="HudInstance" owner="HudInstance/%Widget"]
`);
  /** How many times the walk to `path` reads a scene from the cache. */
  const sceneReads = (path: string): number => {
    let reads = 0;
    claimOwnerOf(path, lent.nodes, {
      ...ctx,
      externalResources: lent.externalResources,
      sceneCache: {
        getCached: (p) => {
          reads++;
          return p === 'res://hud.tscn' ? hudClaimingWidget : scenes.get(p);
        },
      },
    });
    return reads;
  };

  it('reads no more scenes than one walk to a node below the owner', () => {
    expect(sceneReads('Root/HudInstance/Lamp')).toBeLessThanOrEqual(
      sceneReads('Root/HudInstance/Widget/Face')
    );
  });
});
