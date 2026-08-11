/**
 * Grafting a host scene's deep children into an instanced sub-scene's tree.
 *
 * `sceneTreeBuilder` attaches a node whose parent path descends into an
 * instance to the INSTANCE, recording the remainder as `instanceSubPath`. That
 * is as far as the parser can get: only the loaded sub-scene knows what
 * `ColorRect/CenterContainer/VBoxContainer` refers to. This is where the two
 * halves meet.
 *
 * The highest-value test here is the purity one. The loaded sub-scene is a
 * SHARED cache entry — `pause_menu.tscn` is instanced by two different scenes —
 * so a graft that mutated it in place would corrupt every other instance, and
 * would do it in a way that only shows up when a second consumer renders.
 */

import { describe, expect, it, vi } from 'vitest';
import { graftInstanceChildren } from './graftInstanceChildren';
import type { TscnExternalResource, TscnNode } from '../parser/types';
import * as logger from '../logger';

const node = (name: string, extra: Partial<TscnNode> = {}): TscnNode => ({
  type: 'Node3D',
  name,
  properties: {},
  children: [],
  ...extra,
});

/** A loaded sub-scene: Root > Sprite2D > Pivot. */
function subScene(): TscnNode[] {
  return [node('Sprite2D', { children: [node('Pivot')] })];
}

describe('graftInstanceChildren', () => {
  it('appends a direct child at the root, as before', () => {
    const grafted = graftInstanceChildren(subScene(), [node('Extra')]);

    expect(grafted.map((c) => c.name)).toEqual(['Sprite2D', 'Extra']);
  });

  it('grafts a typed deep child at its sub-path', () => {
    const child = node('Body', { instanceSubPath: 'Sprite2D/Pivot' });

    const grafted = graftInstanceChildren(subScene(), [child]);

    const pivot = grafted[0]!.children[0]!;
    expect(pivot.name).toBe('Pivot');
    expect(pivot.children.map((c) => c.name)).toEqual(['Body']);
    // The root gains nothing — the child went inside, not alongside.
    expect(grafted.map((c) => c.name)).toEqual(['Sprite2D']);
  });

  it('merges an override-only child onto the existing node instead of adding a sibling', () => {
    const override = node('Pivot', {
      instanceSubPath: 'Sprite2D',
      overridesExistingNode: true,
      rawProperties: { texture: 'ExtResource("3")' },
    });

    const grafted = graftInstanceChildren(subScene(), [override]);

    const pivot = grafted[0]!.children[0]!;
    expect(grafted[0]!.children).toHaveLength(1);
    expect(pivot.rawProperties?.texture).toBe('ExtResource("3")');
  });

  it('does not mutate the loaded sub-scene', () => {
    // The cache entry is shared across every instance of that scene. Deep-freeze
    // proves the graft copies rather than writes.
    const loaded = subScene();
    const frozen = deepFreeze(loaded);

    expect(() =>
      graftInstanceChildren(frozen, [node('Body', { instanceSubPath: 'Sprite2D/Pivot' })])
    ).not.toThrow();
    expect(frozen[0]!.children[0]!.children).toEqual([]);
  });

  it('stamps the outer resource table onto grafted nodes', () => {
    // A grafted node's ExtResource ids index the OUTER scene's table, but it
    // now renders under the sub-scene's provider — where the same id means a
    // different resource, or nothing at all.
    const outer: TscnExternalResource[] = [{ id: '3', type: 'Texture2D', path: 'res://a.png' }];
    const child = node('Body', { instanceSubPath: 'Sprite2D/Pivot' });

    const grafted = graftInstanceChildren(subScene(), [child], outer);

    expect(grafted[0]!.children[0]!.children[0]!.authoredResources).toBe(outer);
  });

  it('re-anchors at a nested instance rather than failing to descend into it', () => {
    // `Sprite2D` is itself an instance, so `Pivot` lives one scene deeper and
    // is not in this tree yet. Handing the remainder down means the same graft
    // resolves it when THAT node collapses.
    const loaded = [node('Sprite2D', { instance: 'ExtResource("3")' })];
    const child = node('Body', { instanceSubPath: 'Sprite2D/Pivot' });

    const grafted = graftInstanceChildren(loaded, [child]);

    const sprite = grafted[0]!;
    expect(sprite.children.map((c) => c.name)).toEqual(['Body']);
    expect(sprite.children[0]!.instanceSubPath).toBe('Pivot');
  });

  it('appends at the root and warns when the sub-path names nothing', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const child = node('Body', { instanceSubPath: 'NoSuch/Path' });

    const grafted = graftInstanceChildren(subScene(), [child]);

    // Visible-but-misplaced beats invisible.
    expect(grafted.map((c) => c.name)).toEqual(['Sprite2D', 'Body']);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('NoSuch/Path'));
    warnSpy.mockRestore();
  });

  it('is a no-op with no host children', () => {
    const loaded = subScene();
    expect(graftInstanceChildren(loaded, [])).toEqual(loaded);
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
