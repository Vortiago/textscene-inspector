/**
 * Grafting a host scene's deep children into an instanced sub-scene's tree. The purity
 * test matters most: the sub-scene is a shared cache entry, so a graft that wrote into
 * it would corrupt every other instance, visibly only when a second consumer renders.
 */

import { describe, expect, it, vi } from 'vitest';
import { graftInstanceChildren, type InstanceScopes } from './graftInstanceChildren';
import type { InstanceNames, UniqueNamePaths } from './instanceNameTable';
import type { SceneScope, TscnNode } from '../parser/types';
import { scopeOf, type LiveNode } from './liveNode';
import { authoredSpelling } from './authoredSpelling';
import { extResourcePathOf } from './testing/extResourcePathOf';
import * as logger from '../logger';
import { NO_NAMES, NO_SCOPES } from './testing/noScopes';
import type { InstanceNameSetting } from '../parser/nodeOwner';
// The Node parser, which a fold parses an unregistered type with, as in every host.
import '../nodes/node/index';
import '../nodes/base/node3d/index';
import type { Node3DProperties } from '../nodes/base/node3d/types';

const node = (name: string, extra: Partial<TscnNode> = {}): TscnNode => ({
  rawProperties: {},
  type: 'Node3D',
  name,
  properties: {},
  children: [],
  ...extra,
});

const outer: SceneScope = {
  externalResources: [{ id: '1', type: 'Texture2D', path: 'res://outer.png' }],
  internalResources: [{ id: '1', type: 'StandardMaterial3D', data: {} }],
};

const inner: SceneScope = {
  externalResources: [{ id: '1', type: 'Texture2D', path: 'res://inner.png' }],
  internalResources: [],
};

/** The path a node's raw `texture` resolves to, in its own scope or else `groupScope`. */
function texturePath(n: LiveNode, groupScope: SceneScope = inner): string | undefined {
  return extResourcePathOf(n.rawProperties.texture, scopeOf(n, groupScope));
}

/** A graft whose scopes and `%Name` facts are empty unless a test names them. */
function graft(
  rootChildren: readonly LiveNode[],
  hostChildren: readonly LiveNode[],
  { scopes = NO_SCOPES, names = NO_NAMES }: { scopes?: InstanceScopes; names?: InstanceNames } = {}
): LiveNode[] {
  return graftInstanceChildren(rootChildren, hostChildren, scopes, names).children;
}

/** The table and settings a graft reads. */
function names(settings: InstanceNameSetting[], own: UniqueNamePaths = new Map()): InstanceNames {
  return { own: () => own, settings };
}

/** A sub-scene table that claims `%Pivot` for `Sprite2D/Pivot`. */
const CLAIMS_PIVOT: UniqueNamePaths = new Map([['%Pivot', 'Sprite2D/Pivot']]);

/** A loaded sub-scene that instances `Inner`, whose content this graft cannot see. */
function nestedInstanceScene(): TscnNode[] {
  return [node('Inner', { instance: 'ExtResource("2")' })];
}

/** A loaded sub-scene with a `Pivot` at `Sprite2D/Pivot` and another at the root. */
function twoPivotsScene(): TscnNode[] {
  return [...subScene(), node('Pivot')];
}

const HAT_AT_PIVOT = node('Hat', { instanceSubPath: '%Pivot' });
const HAT_AT_DEEP = node('Hat', { instanceSubPath: '%Deep' });

/** A loaded sub-scene: Root > Sprite2D > Pivot. */
function subScene(): TscnNode[] {
  return [node('Sprite2D', { children: [node('Pivot')] })];
}

/** A loaded sub-scene: Root > Sprite2D > Pivot > Shadow, where Pivot and Shadow draw the sub-scene's `1`. */
function texturedSubScene(): TscnNode[] {
  const texture = { texture: 'ExtResource("1")' };
  const shadow = node('Shadow', { type: 'Sprite2D', rawProperties: texture });
  return [
    node('Sprite2D', {
      children: [node('Pivot', { type: 'Sprite2D', rawProperties: texture, children: [shadow] })],
    }),
  ];
}

/** The outer scene's override of `Sprite2D/Pivot`, carrying `raw`. */
function pivotOverride(raw: Record<string, string>): TscnNode {
  return node('Pivot', { instanceSubPath: 'Sprite2D', overridesExistingNode: true, rawProperties: raw });
}

describe('graftInstanceChildren', () => {
  it('appends a direct child at the root, as before', () => {
    const grafted = graft(subScene(), [node('Extra')]);

    expect(grafted.map((c) => c.name)).toEqual(['Sprite2D', 'Extra']);
  });

  it('grafts a typed deep child at its sub-path', () => {
    const child = node('Body', { instanceSubPath: 'Sprite2D/Pivot' });

    const grafted = graft(subScene(), [child]);

    const pivot = grafted[0]!.children[0]!;
    expect(pivot.name).toBe('Pivot');
    expect(pivot.children.map((c) => c.name)).toEqual(['Body']);
    // The root gains nothing: the child went inside, not alongside.
    expect(grafted.map((c) => c.name)).toEqual(['Sprite2D']);
  });

  it('merges an override-only child onto the existing node instead of adding a sibling', () => {
    const override = node('Pivot', {
      instanceSubPath: 'Sprite2D',
      overridesExistingNode: true,
      rawProperties: { texture: 'ExtResource("3")' },
    });

    const grafted = graft(subScene(), [override]);

    const pivot = grafted[0]!.children[0]!;
    expect(grafted[0]!.children).toHaveLength(1);
    expect(pivot.rawProperties.texture).toBe('ExtResource("3")');
  });

  it('re-parses the folded node, so its typed properties take the override', () => {
    const grafted = graft(subScene(), [pivotOverride({ visible: 'false' })]);

    expect((grafted[0]!.children[0]!.properties as Node3DProperties).visible).toBe(false);
  });

  it('keeps the existing node as parsed when the override writes no properties', () => {
    const loaded = subScene();

    const grafted = graft(loaded, [pivotOverride({})]);

    expect(grafted[0]!.children[0]!.properties).toBe(loaded[0]!.children[0]!.properties);
  });

  it('folds an override of a sub-scene root child onto it instead of adding a sibling', () => {
    // `[node name="Health" parent="."]` under an instance root names the root's own child.
    const override = node('Sprite2D', { overridesExistingNode: true, rawProperties: { visible: 'false' } });

    const grafted = graft(subScene(), [override]);

    expect(grafted.map((c) => c.name)).toEqual(['Sprite2D']);
    expect(grafted[0]!.rawProperties.visible).toBe('false');
    expect(grafted[0]!.children.map((c) => c.name)).toEqual(['Pivot']);
  });

  it('does not mutate the loaded sub-scene', () => {
    // The cache entry is shared across every instance of that scene. Deep-freeze
    // proves the graft copies rather than writes.
    const loaded = subScene();
    const frozen = deepFreeze(loaded);

    expect(() => graft(frozen, [node('Body', { instanceSubPath: 'Sprite2D/Pivot' })])).not.toThrow();
    expect(frozen[0]!.children[0]!.children).toEqual([]);
  });

  it('stamps the outer scene BOTH resource tables onto grafted nodes', () => {
    // A grafted node's ids index the outer scene's tables, but it renders under the
    // sub-scene's provider, where the same id means another resource. A node names
    // `ExtResource("3")` and `SubResource("1")` in one block, so `SceneScope` carries
    // both kinds of id.
    const child = node('Body', { instanceSubPath: 'Sprite2D/Pivot' });

    const grafted = graft(subScene(), [child], { scopes: { outer, content: inner } });

    expect(grafted[0]!.children[0]!.children[0]!.scope).toBe(outer);
  });

  it('keeps an overridden node resolving its own references in the sub-scene', () => {
    // The override carries only `modulate`: the node's `texture` is still the sub-scene's.
    const override = pivotOverride({ modulate: 'Color(1, 0, 0, 1)' });

    const pivot = graft(texturedSubScene(), [override], { scopes: { outer, content: inner } })[0]!
      .children[0]!;

    expect(texturePath(pivot)).toBe('res://inner.png');
  });

  it('resolves the override reference in the outer scene', () => {
    const override = pivotOverride({ texture: 'ExtResource("1")' });

    const pivot = graft(texturedSubScene(), [override], { scopes: { outer, content: inner } })[0]!
      .children[0]!;

    expect(texturePath(pivot)).toBe('res://outer.png');
  });

  it('spells the override reference with the id the outer scene wrote', () => {
    const override = pivotOverride({ texture: 'ExtResource("1")' });

    const pivot = graft(texturedSubScene(), [override], { scopes: { outer, content: inner } })[0]!
      .children[0]!;

    expect(authoredSpelling(pivot.rawProperties.texture!, scopeOf(pivot, inner))).toBe('ExtResource("1")');
  });

  it('keeps the sub-scene children of an overridden node in the sub-scene', () => {
    const override = pivotOverride({ texture: 'ExtResource("1")' });

    const pivot = graft(texturedSubScene(), [override], { scopes: { outer, content: inner } })[0]!
      .children[0]!;

    expect(texturePath(pivot.children[0]!, scopeOf(pivot, inner))).toBe('res://inner.png');
  });

  it('keeps the outer scope of a re-anchored child through the nested graft', () => {
    // The nested graft runs with the middle scene as its outer scope, but `Body` was
    // authored in the outermost scene, which its ids index.
    const loaded = [node('Sprite2D', { instance: 'ExtResource("3")' })];
    const middle: SceneScope = { externalResources: [], internalResources: [] };
    const child = node('Body', { instanceSubPath: 'Sprite2D/Pivot' });

    const reanchored = graft(loaded, [child], { scopes: { outer, content: middle } })[0]!.children[0]!;
    // The nested sub-scene's root has `Pivot` as its child.
    const grafted = graft([node('Pivot')], [reanchored], { scopes: { outer: middle, content: inner } });

    expect(grafted[0]!.children[0]!.scope).toBe(outer);
  });

  it('re-anchors at a nested instance rather than failing to descend into it', () => {
    // `Sprite2D` is itself an instance, so `Pivot` lives one scene deeper and
    // is not in this tree yet. Handing the remainder down means the same graft
    // resolves it when that node collapses.
    const loaded = [node('Sprite2D', { instance: 'ExtResource("3")' })];
    const child = node('Body', { instanceSubPath: 'Sprite2D/Pivot' });

    const grafted = graft(loaded, [child]);

    const sprite = grafted[0]!;
    expect(sprite.children.map((c) => c.name)).toEqual(['Body']);
    expect(sprite.children[0]!.instanceSubPath).toBe('Pivot');
  });

  it('keeps a host node seated under an override, in the outer scope', () => {
    // The host's parser seats `[node name="Body" parent="Inst/Sprite2D/Pivot"]` under the override.
    const body = node('Body', { type: 'Sprite2D', rawProperties: { texture: 'ExtResource("1")' } });
    const override = { ...pivotOverride({ visible: 'false' }), children: [body] };

    const pivot = graft(subScene(), [override], { scopes: { outer, content: inner } })[0]!.children[0]!;

    expect(pivot.children.map((c) => c.name)).toEqual(['Body']);
    expect(texturePath(pivot.children[0]!, scopeOf(pivot, inner))).toBe('res://outer.png');
  });

  it('folds an override of a nested instance child when that instance collapses', () => {
    const loaded = [node('Sprite2D', { instance: 'ExtResource("3")' })];
    const override = node('Pivot', {
      instanceSubPath: 'Sprite2D',
      overridesExistingNode: true,
      rawProperties: { visible: 'false' },
    });

    const reanchored = graft(loaded, [override])[0]!.children[0]!;
    const grafted = graft([node('Pivot', { rawProperties: {} })], [reanchored]);

    expect(grafted.map((c) => c.name)).toEqual(['Pivot']);
    expect(grafted[0]!.rawProperties).toEqual({ visible: 'false' });
  });

  it("grafts at the node a sub-path's %Name names in the sub-scene's own table", () => {
    // The walk restarts at the claimed node (node.cpp:1930-1938), wherever it stood.
    const child = node('Hat', { instanceSubPath: 'Sprite2D/%Pivot' });

    const pivot = graft(subScene(), [child], { names: names([], CLAIMS_PIVOT) })[0]!.children[0]!;

    expect(pivot.children.map((c) => c.name)).toEqual(['Hat']);
  });

  it('appends at the root and warns for a missing name before a %Name', () => {
    // A missing child returns nullptr at once (node.cpp:1941-1946), before the %Name is read.
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const child = node('Hat', { instanceSubPath: 'Elsewhere/%Pivot' });

    const grafted = graft(subScene(), [child], { names: names([], CLAIMS_PIVOT) });

    expect(grafted.map((c) => c.name)).toEqual(['Sprite2D', 'Hat']);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('steps up from the claimed node on a .. after the %Name', () => {
    const child = node('Hat', { instanceSubPath: '%Pivot/..' });

    const sprite = graft(subScene(), [child], { names: names([], CLAIMS_PIVOT) })[0]!;

    expect(sprite.children.map((c) => c.name)).toEqual(['Pivot', 'Hat']);
  });

  it('grafts at the node a host override claims in the instance table', () => {
    // The override keeps the sub-scene's owner (resource_format_text.cpp:264-265), so its
    // `unique_name_in_owner` acquires the name there (node.cpp:2236-2249).
    const settings = [{ pathInInstance: 'Sprite2D/Pivot', isUnique: true, hostChildrenBefore: 0 }];

    const pivot = graft(subScene(), [HAT_AT_PIVOT], { names: names(settings) })[0]!.children[0]!;

    expect(pivot.children.map((c) => c.name)).toEqual(['Hat']);
  });

  it('keeps the sub-scene claim over a host override that claims the same name', () => {
    // Instantiate acquires the sub-scene's names first, and the first claimant keeps one (node.cpp:2225-2231).
    const subTree = twoPivotsScene();
    const settings = [{ pathInInstance: 'Pivot', isUnique: true, hostChildrenBefore: 0 }];

    const grafted = graft(subTree, [HAT_AT_PIVOT], { names: names(settings, CLAIMS_PIVOT) });

    expect(grafted[0]!.children[0]!.children.map((c) => c.name)).toEqual(['Hat']);
  });

  it('keeps the first host override claim in file order', () => {
    const subTree = twoPivotsScene();
    const settings = [
      { pathInInstance: 'Pivot', isUnique: true, hostChildrenBefore: 0 },
      { pathInInstance: 'Sprite2D/Pivot', isUnique: true, hostChildrenBefore: 0 },
    ];

    const grafted = graft(subTree, [HAT_AT_PIVOT], { names: names(settings) });

    expect(grafted[1]!.children.map((c) => c.name)).toEqual(['Hat']);
  });

  it('misses a %Name a host override releases', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const settings = [{ pathInInstance: 'Sprite2D/Pivot', isUnique: false, hostChildrenBefore: 0 }];

    const grafted = graft(subScene(), [HAT_AT_PIVOT], { names: names(settings, CLAIMS_PIVOT) });

    expect(grafted.map((c) => c.name)).toEqual(['Sprite2D', 'Hat']);
    warnSpy.mockRestore();
  });

  it('grafts at a claim a host override releases only after the child', () => {
    // Instantiate sets each heading's properties as it reaches it (packed_scene.cpp:157-165).
    const settings = [{ pathInInstance: 'Sprite2D/Pivot', isUnique: false, hostChildrenBefore: 1 }];

    const grafted = graft(subScene(), [HAT_AT_PIVOT], { names: names(settings, CLAIMS_PIVOT) });

    expect(grafted[0]!.children[0]!.children.map((c) => c.name)).toEqual(['Hat']);
  });

  it('misses a claim a host override sets only after the child', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const settings = [{ pathInInstance: 'Sprite2D/Pivot', isUnique: true, hostChildrenBefore: 1 }];

    const grafted = graft(subScene(), [HAT_AT_PIVOT], { names: names(settings) });

    expect(grafted.map((c) => c.name)).toEqual(['Sprite2D', 'Hat']);
    warnSpy.mockRestore();
  });

  it('hands a nested instance a setting after the children it holds by then', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const settings = [{ pathInInstance: 'Inner/Body/Deep', isUnique: true, hostChildrenBefore: 1 }];

    const grafted = graft(nestedInstanceScene(), [node('Body', { instanceSubPath: 'Inner' })], {
      names: names(settings),
    });

    expect(grafted[0]!.instanceNameSettings).toEqual([
      { pathInInstance: 'Body/Deep', isUnique: true, hostChildrenBefore: 1 },
    ]);
    warnSpy.mockRestore();
  });

  it('hands a setting inside a nested instance to that instance, below it', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const subTree = nestedInstanceScene();
    const settings = [{ pathInInstance: 'Inner/Body/Deep', isUnique: true, hostChildrenBefore: 0 }];

    const grafted = graft(subTree, [HAT_AT_DEEP], { names: names(settings) });

    expect(grafted.map((c) => c.name)).toEqual(['Inner', 'Hat']);
    expect(grafted[0]!.instanceNameSettings).toEqual([
      { pathInInstance: 'Body/Deep', isUnique: true, hostChildrenBefore: 0 },
    ]);
    warnSpy.mockRestore();
  });

  it('applies a setting inside a nested instance whose explicit owner is this instance', () => {
    const subTree = nestedInstanceScene();
    const settings = [
      { pathInInstance: 'Inner/Body/Deep', isUnique: true, ownerInInstance: '', hostChildrenBefore: 0 },
    ];

    const grafted = graft(subTree, [HAT_AT_DEEP], { names: names(settings) });

    expect(grafted.map((c) => c.name)).toEqual(['Inner']);
    expect(grafted[0]!.children.map((c) => [c.name, c.instanceSubPath])).toEqual([['Hat', 'Body/Deep']]);
    expect(grafted[0]!.instanceNameSettings).toBeUndefined();
  });

  it('hands an explicit owner inside a nested instance to that instance, rebased', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const subTree = nestedInstanceScene();
    const settings = [
      { pathInInstance: 'Inner/Body/Deep', isUnique: true, ownerInInstance: 'Inner', hostChildrenBefore: 0 },
    ];

    const grafted = graft(subTree, [HAT_AT_DEEP], { names: names(settings) });

    expect(grafted[0]!.instanceNameSettings).toEqual([
      { pathInInstance: 'Body/Deep', isUnique: true, ownerInInstance: '', hostChildrenBefore: 0 },
    ]);
    warnSpy.mockRestore();
  });

  it('appends at the root and warns for a %Name the sub-scene does not claim', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const grafted = graft(subScene(), [node('Hat', { instanceSubPath: '%Gone' })]);

    expect(grafted.map((c) => c.name)).toEqual(['Sprite2D', 'Hat']);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('appends at the root and warns when the sub-path names nothing', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const child = node('Body', { instanceSubPath: 'NoSuch/Path' });

    const grafted = graft(subScene(), [child]);

    // Visible-but-misplaced beats invisible.
    expect(grafted.map((c) => c.name)).toEqual(['Sprite2D', 'Body']);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('NoSuch/Path'));
    warnSpy.mockRestore();
  });

  it('is a no-op with no host children', () => {
    const loaded = subScene();
    expect(graft(loaded, [])).toEqual(loaded);
  });
});

function deepFreeze(nodes: readonly TscnNode[]): readonly TscnNode[] {
  for (const n of nodes) {
    deepFreeze(n.children);
    Object.freeze(n.children);
    Object.freeze(n);
  }
  return Object.freeze(nodes);
}

describe('graftInstanceChildren: index=', () => {
  const root = [node('A'), node('B')];
  const namesOf = (children: readonly LiveNode[]) => children.map((c) => c.name);

  it('places a direct child at the index its heading states (packed_scene.cpp:543-544)', () => {
    expect(namesOf(graft(root, [node('C', { index: 0 })]))).toEqual(['C', 'A', 'B']);
    expect(namesOf(graft(root, [node('C', { index: 1 })]))).toEqual(['A', 'C', 'B']);
  });

  it('keeps a direct child last when its index is the last place', () => {
    expect(namesOf(graft(root, [node('C', { index: 2 })]))).toEqual(['A', 'B', 'C']);
  });

  it('counts the host children already added, in file order', () => {
    expect(namesOf(graft(root, [node('C'), node('D', { index: 0 })]))).toEqual(['D', 'A', 'B', 'C']);
  });

  it('places a child grafted deeper among the children of the node it names', () => {
    const deep = [node('Arm', { children: [node('Hand'), node('Glove')] })];
    const grafted = graft(deep, [node('Ring', { instanceSubPath: 'Arm', index: 1 })]);

    expect(namesOf(grafted[0]!.children)).toEqual(['Hand', 'Ring', 'Glove']);
  });
});
