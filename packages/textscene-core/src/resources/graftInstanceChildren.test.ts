/**
 * Grafting a host scene's deep children into an instanced sub-scene's tree. The purity
 * test matters most: the sub-scene is a shared cache entry, so a graft that wrote into
 * it would corrupt every other instance, visibly only when a second consumer renders.
 */

import { describe, expect, it, vi } from 'vitest';
import { graftInstanceChildren } from './graftInstanceChildren';
import type { SceneScope, TscnNode } from '../parser/types';
import { scopeOf, type LiveNode } from './liveNode';
import { authoredSpelling } from './authoredSpelling';
import { extResourcePathOf } from './testing/extResourcePathOf';
import * as logger from '../logger';
import { NO_SCOPES } from './testing/noScopes';
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
    const grafted = graftInstanceChildren(subScene(), [node('Extra')], NO_SCOPES);

    expect(grafted.map((c) => c.name)).toEqual(['Sprite2D', 'Extra']);
  });

  it('grafts a typed deep child at its sub-path', () => {
    const child = node('Body', { instanceSubPath: 'Sprite2D/Pivot' });

    const grafted = graftInstanceChildren(subScene(), [child], NO_SCOPES);

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

    const grafted = graftInstanceChildren(subScene(), [override], NO_SCOPES);

    const pivot = grafted[0]!.children[0]!;
    expect(grafted[0]!.children).toHaveLength(1);
    expect(pivot.rawProperties.texture).toBe('ExtResource("3")');
  });

  it('re-parses the folded node, so its typed properties take the override', () => {
    const grafted = graftInstanceChildren(subScene(), [pivotOverride({ visible: 'false' })], NO_SCOPES);

    expect((grafted[0]!.children[0]!.properties as Node3DProperties).visible).toBe(false);
  });

  it('keeps the existing node as parsed when the override writes no properties', () => {
    const loaded = subScene();

    const grafted = graftInstanceChildren(loaded, [pivotOverride({})], NO_SCOPES);

    expect(grafted[0]!.children[0]!.properties).toBe(loaded[0]!.children[0]!.properties);
  });

  it('folds an override of a sub-scene root child onto it instead of adding a sibling', () => {
    // `[node name="Health" parent="."]` under an instance root names the root's own child.
    const override = node('Sprite2D', { overridesExistingNode: true, rawProperties: { visible: 'false' } });

    const grafted = graftInstanceChildren(subScene(), [override], NO_SCOPES);

    expect(grafted.map((c) => c.name)).toEqual(['Sprite2D']);
    expect(grafted[0]!.rawProperties.visible).toBe('false');
    expect(grafted[0]!.children.map((c) => c.name)).toEqual(['Pivot']);
  });

  it('does not mutate the loaded sub-scene', () => {
    // The cache entry is shared across every instance of that scene. Deep-freeze
    // proves the graft copies rather than writes.
    const loaded = subScene();
    const frozen = deepFreeze(loaded);

    expect(() =>
      graftInstanceChildren(frozen, [node('Body', { instanceSubPath: 'Sprite2D/Pivot' })], NO_SCOPES)
    ).not.toThrow();
    expect(frozen[0]!.children[0]!.children).toEqual([]);
  });

  it('stamps the outer scene BOTH resource tables onto grafted nodes', () => {
    // A grafted node's ids index the outer scene's tables, but it renders under the
    // sub-scene's provider, where the same id means another resource. A node names
    // `ExtResource("3")` and `SubResource("1")` in one block, so `SceneScope` carries
    // both kinds of id.
    const child = node('Body', { instanceSubPath: 'Sprite2D/Pivot' });

    const grafted = graftInstanceChildren(subScene(), [child], { outer, content: inner });

    expect(grafted[0]!.children[0]!.children[0]!.scope).toBe(outer);
  });

  it('keeps an overridden node resolving its own references in the sub-scene', () => {
    // The override carries only `modulate`: the node's `texture` is still the sub-scene's.
    const override = pivotOverride({ modulate: 'Color(1, 0, 0, 1)' });

    const pivot = graftInstanceChildren(texturedSubScene(), [override], { outer, content: inner })[0]!
      .children[0]!;

    expect(texturePath(pivot)).toBe('res://inner.png');
  });

  it('resolves the override reference in the outer scene', () => {
    const override = pivotOverride({ texture: 'ExtResource("1")' });

    const pivot = graftInstanceChildren(texturedSubScene(), [override], { outer, content: inner })[0]!
      .children[0]!;

    expect(texturePath(pivot)).toBe('res://outer.png');
  });

  it('spells the override reference with the id the outer scene wrote', () => {
    const override = pivotOverride({ texture: 'ExtResource("1")' });

    const pivot = graftInstanceChildren(texturedSubScene(), [override], { outer, content: inner })[0]!
      .children[0]!;

    expect(authoredSpelling(pivot.rawProperties.texture!, scopeOf(pivot, inner))).toBe('ExtResource("1")');
  });

  it('keeps the sub-scene children of an overridden node in the sub-scene', () => {
    const override = pivotOverride({ texture: 'ExtResource("1")' });

    const pivot = graftInstanceChildren(texturedSubScene(), [override], { outer, content: inner })[0]!
      .children[0]!;

    expect(texturePath(pivot.children[0]!, scopeOf(pivot, inner))).toBe('res://inner.png');
  });

  it('keeps the outer scope of a re-anchored child through the nested graft', () => {
    // The nested graft runs with the middle scene as its outer scope, but `Body` was
    // authored in the outermost scene, which its ids index.
    const loaded = [node('Sprite2D', { instance: 'ExtResource("3")' })];
    const middle: SceneScope = { externalResources: [], internalResources: [] };
    const child = node('Body', { instanceSubPath: 'Sprite2D/Pivot' });

    const reanchored = graftInstanceChildren(loaded, [child], { outer, content: middle })[0]!.children[0]!;
    // The nested sub-scene's root has `Pivot` as its child.
    const grafted = graftInstanceChildren([node('Pivot')], [reanchored], { outer: middle, content: inner });

    expect(grafted[0]!.children[0]!.scope).toBe(outer);
  });

  it('re-anchors at a nested instance rather than failing to descend into it', () => {
    // `Sprite2D` is itself an instance, so `Pivot` lives one scene deeper and
    // is not in this tree yet. Handing the remainder down means the same graft
    // resolves it when that node collapses.
    const loaded = [node('Sprite2D', { instance: 'ExtResource("3")' })];
    const child = node('Body', { instanceSubPath: 'Sprite2D/Pivot' });

    const grafted = graftInstanceChildren(loaded, [child], NO_SCOPES);

    const sprite = grafted[0]!;
    expect(sprite.children.map((c) => c.name)).toEqual(['Body']);
    expect(sprite.children[0]!.instanceSubPath).toBe('Pivot');
  });

  it('keeps a host node seated under an override, in the outer scope', () => {
    // The host's parser seats `[node name="Body" parent="Inst/Sprite2D/Pivot"]` under the override.
    const body = node('Body', { type: 'Sprite2D', rawProperties: { texture: 'ExtResource("1")' } });
    const override = { ...pivotOverride({ visible: 'false' }), children: [body] };

    const pivot = graftInstanceChildren(subScene(), [override], { outer, content: inner })[0]!.children[0]!;

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

    const reanchored = graftInstanceChildren(loaded, [override], NO_SCOPES)[0]!.children[0]!;
    const grafted = graftInstanceChildren([node('Pivot', { rawProperties: {} })], [reanchored], NO_SCOPES);

    expect(grafted.map((c) => c.name)).toEqual(['Pivot']);
    expect(grafted[0]!.rawProperties).toEqual({ visible: 'false' });
  });

  it('appends at the root and warns when the sub-path names nothing', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const child = node('Body', { instanceSubPath: 'NoSuch/Path' });

    const grafted = graftInstanceChildren(subScene(), [child], NO_SCOPES);

    // Visible-but-misplaced beats invisible.
    expect(grafted.map((c) => c.name)).toEqual(['Sprite2D', 'Body']);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('NoSuch/Path'));
    warnSpy.mockRestore();
  });

  it('is a no-op with no host children', () => {
    const loaded = subScene();
    expect(graftInstanceChildren(loaded, [], NO_SCOPES)).toEqual(loaded);
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
