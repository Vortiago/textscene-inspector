/**
 * WI-HALL-3: synthesised root for a PackedScene that's actually a GLB/GLTF.
 *
 * Godot PackedScene refs can point at .glb / .gltf files (the hallway
 * fixture references PortraitFrame2.glb, doormesh.glb, grandfatherclock.glb,
 * etc.). Pre-WI-HALL-3 the `createSceneProcessor` threw
 * "Scene must be text content" when handed an ArrayBuffer and the user
 * saw a magenta placeholder cube via `<MissingResourcePlaceholder shape="box">`.
 *
 * Fix shape: when the processor detects a `.glb` / `.gltf` path it
 * synthesises a TscnScene with a single root node of type
 * `GLBSceneRoot`, whose `properties.glbPath` carries the resource path.
 * This component does the actual GLB load via the existing
 * `useResource('GLBMesh', path)` flow and renders the resulting
 * THREE.Object3D inline via `<primitive>`. Identical lifecycle to a
 * standalone .glb mesh — the consumer (NodeDispatcher.InstancedSceneSubtree
 * after the synthesised scene loads) sees a normal scene with one
 * dispatched node.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../NodeComponentRegistry';
import { useResource } from '../../../resources/useResource';
import { MissingResourcePlaceholder } from '../../components/MissingResourcePlaceholder';
import { useGlbOverrides } from './GlbOverridesContext';
import { applyGlbNodeOverrides } from './glbNodeOverrides';

/**
 * Reserved node type the createSceneProcessor synthesises for binary
 * (GLB/GLTF) PackedScene content. Not a user-authorable TSCN type —
 * created programmatically; the linter never sees it.
 */
export const GLB_SCENE_ROOT_TYPE = 'GLBSceneRoot';

interface GLBSceneRootProperties {
  /** `res://` path to the .glb / .gltf file (carried verbatim from the
   *  ExtResource that triggered the synthesis). */
  glbPath: string;
}

export function GLBSceneRoot({ node }: NodeComponentProps) {
  // The synthesised node's `properties` slot is a Record<string, unknown>
  // populated by createSceneProcessor; cast through unknown so it
  // satisfies the Node3DProperties union the dispatcher carries.
  const props = node.properties as unknown as GLBSceneRootProperties;
  const result = useResource<THREE.Object3D>(props.glbPath ?? '', 'GLBMesh');

  // BUG 2: the instancing scene's inline override children (e.g.
  // roof_lamp.tscn's `plafoniera`) target nodes INSIDE this GLB. Apply
  // their transforms onto the matching GLB-internal nodes by name, so a
  // GLB node's large baked translation is overridden as Godot does.
  const overrides = useGlbOverrides();
  const object = result.value;
  useMemo(() => {
    if (object) applyGlbNodeOverrides(object, overrides);
    // The clone is per-consumer and stable, so re-applying when the
    // resolved object or override set changes is sufficient and cheap.
  }, [object, overrides]);

  if (result.status === 'unavailable') {
    return <MissingResourcePlaceholder shape="box" />;
  }
  if (result.status === 'pending' || !object) {
    return null;
  }
  // useResource already clones GLB Object3D per consumer to satisfy
  // three.js's "Object3D can only have one parent" invariant, so we
  // mount the returned ref directly via <primitive>.
  return <primitive object={object} />;
}
