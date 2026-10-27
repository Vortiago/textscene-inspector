/**
 * A reader of one step of the live tree renders again only for a load that changes its step: the step
 * is the tree's, so a load of a scene or GLB it did not read hands back the same object.
 */
import { describe, expect, it } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import * as THREE from 'three';
import type { ReactNode } from 'react';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext.js';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader.js';
import { makeNode } from '../parser/testing/parserKit.js';
import type { TscnExternalResource, TscnNode, TscnScene } from '../parser/types.js';
import { useInstancedScene } from './hooks/useInstancedScene.js';
import { useLiveStepOf } from './useLiveSceneTree.js';
// The Instance root merge parses a sub-scene root with the Node parser when its type has none.
import '../nodes/node/index';

const externalResources: TscnExternalResource[] = [{ id: '1', path: 'res://kid.tscn', type: 'PackedScene' }];
const scope = { externalResources, internalResources: [] };

const instance = makeNode('Kid', 'Node3D', { instance: 'ExtResource("1")' });
const model = makeNode('Model', 'GLBSceneRoot', {
  properties: { glbPath: 'res://model.glb' } as Record<string, unknown>,
});

const kid: TscnScene = {
  nodes: [makeNode('Kid', 'CharacterBody3D')],
  externalResources: [],
  internalResources: [],
};
const other: TscnScene = {
  nodes: [makeNode('Other', 'Node3D')],
  externalResources: [],
  internalResources: [],
};

function mount(node: TscnNode) {
  const fake = createFakeResourceLoader();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
  );
  const hook = renderHook(() => useLiveStepOf(node, scope), { wrapper });
  return { fake, hook };
}

/** Asks the step of the instance, and then lets `kid.tscn` land with no event, as a load nobody listens for does. */
function LoadsUnseen({ fake }: { fake: ReturnType<typeof createFakeResourceLoader> }) {
  useLiveStepOf(instance, scope);
  fake.scenes.seed('res://kid.tscn', kid);
  return null;
}

/** Records, for each render, whether the scene reads as loaded and whether the step merged it. */
function MountedScene({ renders }: { renders: [loaded: boolean, merged: boolean][] }) {
  const loaded =
    useInstancedScene('ExtResource("1")', externalResources, 'res://kid.tscn').status === 'loaded';
  renders.push([loaded, useLiveStepOf(instance, scope).isMerged]);
  return null;
}

describe('useLiveStepOf', () => {
  it('keeps the same step across the load of a scene it did not read', () => {
    const { fake, hook } = mount(instance);
    const before = hook.result.current;

    act(() => fake.scenes._resolve('res://other.tscn', other));

    expect(hook.result.current).toBe(before);
  });

  it('gives the merged step once the scene it instances loads', () => {
    const { fake, hook } = mount(instance);

    act(() => fake.scenes._resolve('res://kid.tscn', kid));

    expect([hook.result.current.isMerged, hook.result.current.node.type]).toEqual([true, 'CharacterBody3D']);
  });

  it('gives the GLB group once the GLB it holds loads', () => {
    const { fake, hook } = mount(model);
    const glb = new THREE.Group();
    glb.add(Object.assign(new THREE.Mesh(), { name: 'body' }));

    act(() => fake.glbMeshes._resolve('res://model.glb', glb));

    expect(hook.result.current.groups.map((group) => group.origin)).toEqual(['glb']);
  });

  it('shows the node as authored with no loader', () => {
    const hook = renderHook(() => useLiveStepOf(instance, scope));

    expect([hook.result.current.node, hook.result.current.isMerged]).toEqual([instance, false]);
  });

  it('never gives a step that has not read a scene the same render finds loaded', () => {
    const fake = createFakeResourceLoader();
    const renders: [loaded: boolean, merged: boolean][] = [];

    render(
      <ResourceLoaderProvider loader={fake.loader}>
        <LoadsUnseen fake={fake} />
        <MountedScene renders={renders} />
      </ResourceLoaderProvider>
    );

    expect(renders.filter(([loaded, merged]) => loaded && !merged)).toEqual([]);
  });

  it('never gives a step that has not read a scene the same render finds loaded, for a load by event', () => {
    const fake = createFakeResourceLoader();
    const renders: [loaded: boolean, merged: boolean][] = [];
    render(
      <ResourceLoaderProvider loader={fake.loader}>
        <MountedScene renders={renders} />
      </ResourceLoaderProvider>
    );

    act(() => fake.scenes._resolve('res://kid.tscn', kid));

    expect([renders.at(-1), renders.filter(([loaded, merged]) => loaded && !merged)]).toEqual([
      [true, true],
      [],
    ]);
  });
});
