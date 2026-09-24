/**
 * The root `createSceneProcessor` synthesises for a `.glb` or `.gltf` PackedScene. It loads the
 * GLB through `useResource('GLBMesh', path)`, renders it as a `<primitive>`, and drives its clips
 * (ADR-0012) through a `THREE.AnimationMixer` rooted on the GLB object, since the clips bind to
 * the GLB's own node names.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../NodeComponentRegistry';
import { useResource } from '../../../resources/useResource';
import { MissingResourcePlaceholder } from '../../components/MissingResourcePlaceholder';
import { useGlbOverrides } from './GlbOverridesContext';
import {
  applyGlbNodeOverrides,
  isApplicableGlbOverride,
  resolveGlbOverrideTarget,
} from './glbNodeOverrides';
import { flattenGlbObjects, GLB_ANIMATION_PLAYER_NAME, type GlbObjectEntry } from './glbHierarchy';
import { useAnimationTransport, type PlayState } from '../../contexts/AnimationTransportContext';
import { useNodePath } from '../../contexts/NodePathContext';
import { useOptionalSelection } from '../../contexts/SelectionContext';
import { usePlaybackLoop } from '../../animation/usePlaybackLoop';
import { applyLoopOverride, LOOP_REPEAT_SETTINGS } from '../../animation/loopOverride';
import { snapshotSubtree, restoreSnapshot, type PoseSnapshot } from '../../animation/poseSnapshot';
import { useAnimationDriverMount } from '../../animation/useAnimationDriverMount';
import { joinPath } from '../../../utils/nodePath';
import type { ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types';
import { useSceneResources } from '../../SceneResourcesContext';
import { resolveMaterialSource } from '../../materials/materialSource';
import { GlbSurfaceMaterialOverride } from './GlbSurfaceMaterialOverride';
import { boolSlotValue } from '../../../godot/index.js';

/** Reserved for a synthesised GLB root: no `.tscn` declares it, and the linter never sees it. */
export const GLB_SCENE_ROOT_TYPE = 'GLBSceneRoot';

interface GLBSceneRootProperties {
  /** The ExtResource's `res://` path to the .glb or .gltf file, verbatim. */
  glbPath: string;
}


export function GLBSceneRoot({ node, children }: NodeComponentProps) {
  // createSceneProcessor fills `properties` as a Record, so cast through unknown.
  const props = node.properties as unknown as GLBSceneRootProperties;
  const result = useResource<THREE.Object3D>(props.glbPath ?? '', 'glb');

  // The instancing scene's inline override children target nodes inside this GLB, by name, so
  // a baked translation is overridden as in Godot.
  const overrides = useGlbOverrides();
  const object = result.value;

  // One flattening of the clone, shared by selection, visibility, overrides and material slots.
  const entries = useMemo(() => (object ? flattenGlbObjects(object) : []), [object]);

  // The clone is per consumer and stable, so re-applying on a change of its inputs is enough.
  useMemo(() => {
    if (object) applyGlbNodeOverrides(object, overrides, entries);
  }, [object, overrides, entries]);

  // A `surface_material_override/0` needs an ExtResource resolved and a `.tres` loaded, which
  // the synchronous mutation above cannot do, so each one mounts its own slot component.
  const materialOverrides = useGlbMaterialOverrides(object, entries, overrides);

  // Registers each GLB object under the tree's relPath scheme, so the SceneTreeViewer can select
  // and hide it.
  const selection = useOptionalSelection();
  const nodePath = useNodePath();

  const registerNodeObject = selection?.registerNodeObject;
  const unregisterNodeObject = selection?.unregisterNodeObject;
  useEffect(() => {
    if (!registerNodeObject || !unregisterNodeObject || nodePath === null) return;
    for (const { relPath, object: obj } of entries) {
      registerNodeObject(joinPath(nodePath, relPath), obj);
    }
    return () => {
      for (const { relPath } of entries) unregisterNodeObject(joinPath(nodePath, relPath));
    };
  }, [entries, nodePath, registerNodeObject, unregisterNodeObject]);

  // `applyGlbNodeOverrides` writes `visible` during render, and the hidden-paths effect below then
  // assigns every entry's `visible`. Both write one field, so it resolves here, or an authored
  // `visible = false` is switched back on.
  const overrideHidden = useMemo(() => {
    const hidden = new Set<THREE.Object3D>();
    if (!object) return hidden;
    for (const override of overrides) {
      if (boolSlotValue(override.rawProperties?.visible) !== false) continue;
      if (!isApplicableGlbOverride(override)) continue;
      const target = resolveGlbOverrideTarget(object, entries, override);
      if (target) hidden.add(target);
    }
    return hidden;
  }, [object, entries, overrides]);

  const hiddenNodePaths = selection?.hiddenNodePaths;
  useEffect(() => {
    if (nodePath === null) return;
    for (const { relPath, object: obj } of entries) {
      obj.visible =
        !(hiddenNodePaths?.has(joinPath(nodePath, relPath)) ?? false) && !overrideHidden.has(obj);
    }
  }, [entries, nodePath, hiddenNodePaths, overrideHidden]);

  // As in Godot, a GLB's clips live on an `AnimationPlayer` child that `glbSceneRootChildren`
  // synthesises, so selecting that child, not the GLB root, activates the driver.
  const transport = useAnimationTransport();
  const selectedNodePath = selection?.selectedNodePath ?? null;
  const animationPlayerPath =
    nodePath !== null ? joinPath(nodePath, GLB_ANIMATION_PLAYER_NAME) : null;
  const isActive = animationPlayerPath !== null && animationPlayerPath === selectedNodePath;

  const { clips, durations } = useMemo(() => {
    const list = object?.animations ?? [];
    return {
      clips: list,
      durations: Object.fromEntries(list.map((c) => [c.name, c.duration])),
    };
  }, [object]);

  // A full-subtree snapshot (poseSnapshot.ts), since skeletal and blended clips touch any bone.
  // AnimationPlayer snapshots only its tracks.
  const snapshotRef = useRef<PoseSnapshot[]>([]);
  const restore = useCallback(() => restoreSnapshot(snapshotRef.current), []);

  const { mixerRef, actionsRef } = useAnimationDriverMount({
    // Always passed, so the AnimationDriverRegistry entry exists whatever the selection, and an
    // AnimationTree whose `anim_player` resolves here can root its mixer. The hook gates the
    // mixer build on isActive.
    object: object ?? null,
    clips,
    // The synthesised AnimationPlayer path, not the GLB root, so an AnimationTree resolving
    // `anim_player` here finds the object and its clips.
    nodePath: animationPlayerPath,
    isActive,
    durations,
    onMixerBuilt: useCallback(
      (root) => {
        snapshotRef.current = snapshotSubtree(root);
      },
      []
    ),
    restore,
  });

  // An inactive driver is 'stopped', so it never touches the scene and restores the authored
  // pose when it loses selection.
  const effectiveState: PlayState = isActive ? transport.playState : 'stopped';
  usePlaybackLoop({
    playState: effectiveState,
    selectedClip: isActive ? transport.selectedClip : null,
    transportTime: transport.time,
    speedScale: transport.playbackSpeed,
    mixerRef,
    actionsRef,
    // Native glTF clips have no loop_mode and repeat for ever, so 'auto' and 'loop' repeat. The
    // preview loop override can force one clamped pass.
    configureAction: (action) =>
      applyLoopOverride(action, transport.loopOverride, LOOP_REPEAT_SETTINGS),
    reconfigureKey: transport.loopOverride,
    reportTime: transport.reportTime,
    restore,
  });

  // `children` is the subtree the host scene parents under this root, as Godot parents an
  // instanced scene's extra nodes to its root node. Every branch renders it,
  // or a slow or missing .glb deletes those nodes too.
  if (result.status === 'unavailable') {
    return (
      <>
        <MissingResourcePlaceholder shape="box" />
        {children}
      </>
    );
  }
  if (result.status === 'pending' || !object) {
    return <>{children}</>;
  }
  // useResource clones the Object3D per consumer, so the value mounts directly.
  return (
    <primitive object={object}>
      {materialOverrides}
      {children}
    </primitive>
  );
}

/**
 * One `<GlbSurfaceMaterialOverride>` per override node with a `surface_material_override/0`. The
 * path resolves through `matchGlbTarget`, as the transform overrides do, so a Godot path and a
 * three path that disagree about importer-synthesised levels land on one mesh.
 */
function useGlbMaterialOverrides(
  object: THREE.Object3D | undefined,
  entries: readonly GlbObjectEntry[],
  overrides: readonly TscnNode[]
): ReactNode {
  const { internalResources, externalResources } = useSceneResources();

  return useMemo(() => {
    if (!object) return null;

    const slots: ReactNode[] = [];
    for (const override of overrides) {
      const ref = override.rawProperties?.['surface_material_override/0'];
      if (!ref || !isApplicableGlbOverride(override)) continue;

      // A grafted override's ids belong to the outer scene that authored it, not the sub-scene it
      // renders under. Both pools travel together (`AuthoredResourceScope`), so a SubResource
      // override resolves there too.
      const source = resolveMaterialSource(
        ref,
        override.authoredScope?.internalResources ?? internalResources,
        override.authoredScope?.externalResources ?? externalResources
      );
      if (!source) continue;

      const target = resolveGlbOverrideTarget(object, entries, override);
      if (!target) continue;

      slots.push(
        <GlbSurfaceMaterialOverride
          key={joinPath(override.instanceSubPath ?? '', override.name)}
          target={target}
          source={source}
        />
      );
    }
    return slots.length > 0 ? <>{slots}</> : null;
  }, [object, entries, overrides, internalResources, externalResources]);
}
