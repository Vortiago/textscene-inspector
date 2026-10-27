/**
 * A step of the live tree outlives the tree that took it: a tree over a later snapshot of the loader's
 * caches gives the same step while every cache answer the step read is unchanged, so a reader that
 * renders from it does not render again for a load that is none of its business.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeNode } from '../parser/testing/parserKit';
import type { TscnExternalResource, TscnScene } from '../parser/types';
import { rootScope, type LiveTreeContext } from './liveSceneTree';
import { contextOver, stepOver } from './liveSceneTree.testkit';
// The Instance root merge parses a sub-scene root with the Node parser when its type has none.
import '../nodes/node/index';

const externalResources: TscnExternalResource[] = [{ id: '1', path: 'res://kid.tscn', type: 'PackedScene' }];

const main: TscnScene = {
  nodes: [makeNode('Kid', 'Node3D', { instance: 'ExtResource("1")' })],
  externalResources,
  internalResources: [],
};

const kid: TscnScene = {
  nodes: [makeNode('Kid', 'CharacterBody3D')],
  externalResources: [],
  internalResources: [],
};

const instance = main.nodes[0]!;

const model = makeNode('Model', 'GLBSceneRoot', {
  properties: { glbPath: 'res://model.glb' } as Record<string, unknown>,
});

/** A GLB with one object `body`. */
function bodyGlb(): THREE.Object3D {
  const glb = new THREE.Group();
  glb.add(Object.assign(new THREE.Mesh(), { name: 'body' }));
  return glb;
}

/** The step of the instance over a fresh snapshot of `ctx`. */
function stepOfInstance(ctx: LiveTreeContext) {
  return stepOver(instance, rootScope(ctx), ctx.sceneCache, ctx.glbCache);
}

describe('a step reused by a tree over a later snapshot', () => {
  it('is the same step while the scene it read is unchanged', () => {
    const before = stepOfInstance(contextOver(main, { 'res://kid.tscn': kid }));

    const after = stepOfInstance(contextOver(main, { 'res://kid.tscn': kid }));

    expect(after).toBe(before);
  });

  it('is the same step while the scene it read is still not cached', () => {
    const before = stepOfInstance(contextOver(main, {}));

    const after = stepOfInstance(contextOver(main, {}));

    expect(after).toBe(before);
  });

  it('is a new step once the scene it read loads', () => {
    const scenes: Record<string, TscnScene> = {};
    const before = stepOfInstance(contextOver(main, scenes));
    scenes['res://kid.tscn'] = kid;

    const after = stepOfInstance(contextOver(main, scenes));

    expect([before.isMerged, after.isMerged]).toEqual([false, true]);
  });

  it('is a new step once the scene it read is replaced', () => {
    const before = stepOfInstance(contextOver(main, { 'res://kid.tscn': kid }));
    const reloaded: TscnScene = { ...kid, nodes: [makeNode('Kid', 'RigidBody3D')] };

    const after = stepOfInstance(contextOver(main, { 'res://kid.tscn': reloaded }));

    expect([before.node.type, after.node.type]).toEqual(['CharacterBody3D', 'RigidBody3D']);
  });

  it('is a new step once the GLB it read loads', () => {
    const glbs: Record<string, THREE.Object3D> = {};
    const stepOfHost = () => {
      const ctx = contextOver(main, {}, glbs);
      return stepOver(model, rootScope(ctx), ctx.sceneCache, ctx.glbCache);
    };
    const before = stepOfHost();
    glbs['res://model.glb'] = bodyGlb();

    const after = stepOfHost();

    expect([before.groups[0]!.origin, after.groups[0]!.origin]).toEqual(['inline', 'glb']);
  });

  it('is a new step for a context with a GLB cache after one without', () => {
    const withoutGlbCache = contextOver(main, {});
    const before = stepOver(model, rootScope(withoutGlbCache), withoutGlbCache.sceneCache);
    const withGlbCache = contextOver(main, {}, { 'res://model.glb': bodyGlb() });

    const after = stepOver(model, rootScope(withGlbCache), withGlbCache.sceneCache, withGlbCache.glbCache);

    expect([before.groups[0]!.origin, after.groups[0]!.origin]).toEqual(['inline', 'glb']);
  });

  it('is a step of its own for each scope the node is asked in', () => {
    const ctx = contextOver(main, { 'res://kid.tscn': kid });
    const otherScope = { ...rootScope(ctx), externalResources: [] };

    expect(stepOver(instance, otherScope, ctx.sceneCache)).not.toBe(
      stepOver(instance, rootScope(ctx), ctx.sceneCache)
    );
  });

  it('keeps the step of a scope it was asked in after it was asked in another', () => {
    const ctx = contextOver(main, { 'res://kid.tscn': kid });
    const first = stepOver(instance, rootScope(ctx), ctx.sceneCache);
    stepOver(instance, { ...rootScope(ctx), externalResources: [] }, ctx.sceneCache);

    expect(stepOver(instance, rootScope(ctx), ctx.sceneCache)).toBe(first);
  });

  it('keeps the step of a scope it was asked in after it was asked in many others (edge case)', () => {
    const ctx = contextOver(main, { 'res://kid.tscn': kid });
    const first = stepOver(instance, rootScope(ctx), ctx.sceneCache);
    for (let other = 0; other < 20; other++) {
      stepOver(
        instance,
        { ...rootScope(ctx), instancedScenePaths: [`res://room${other}.tscn`] },
        ctx.sceneCache
      );
    }

    expect(stepOver(instance, rootScope(ctx), ctx.sceneCache)).toBe(first);
  });
});
