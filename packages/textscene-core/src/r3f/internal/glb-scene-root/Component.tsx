/**
 * Synthesised root for a PackedScene that's actually a GLB/GLTF.
 *
 * Godot PackedScene refs can point at .glb / .gltf files (a single scene
 * can reference props/chest.glb, props/lamp.glb, props/clock.glb,
 * etc.). Previously the `createSceneProcessor` threw
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
 *
 * Beyond rendering, a GLB carries its own animation clips. Godot's glTF import
 * exposes them on an `AnimationPlayer` node inside the imported hierarchy (a
 * child of the root), so the tree synthesises that node (`glbSceneRootChildren`)
 * when the GLB has clips. This component is the **GLB animation driver**: when
 * that AnimationPlayer child row is the selected node it registers the clips
 * with the selection-driven Animation transport (ADR-0012) and drives a
 * `THREE.AnimationMixer` rooted on the loaded GLB object — the GLB counterpart
 * to the AnimationPlayer slice (ADR-0011). The clips arrive already bound to the
 * GLB's own node names, so the mixer roots on the object itself rather than on
 * an Animation root / `root_node`.
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


export function GLBSceneRoot({ node, children }: NodeComponentProps) {
  // The synthesised node's `properties` slot is a Record<string, unknown>
  // populated by createSceneProcessor; cast through unknown so it
  // satisfies the Node3DProperties union the dispatcher carries.
  const props = node.properties as unknown as GLBSceneRootProperties;
  const result = useResource<THREE.Object3D>(props.glbPath ?? '', 'glb');

  // BUG 2: the instancing scene's inline override children (e.g.
  // ceiling_lamp.tscn's `plafoniera`) target nodes INSIDE this GLB. Apply
  // their transforms onto the matching GLB-internal nodes by name, so a
  // GLB node's large baked translation is overridden as Godot does.
  const overrides = useGlbOverrides();
  const object = result.value;

  // ONE flattening of the loaded clone, shared by everything below: selection
  // registration, visibility, override resolution and the material slots all
  // ask the same question of the same graph.
  const entries = useMemo(() => (object ? flattenGlbObjects(object) : []), [object]);

  // BUG 2 (cont.): apply the overrides' transforms / layers / visibility.
  useMemo(() => {
    if (object) applyGlbNodeOverrides(object, overrides, entries);
    // The clone is per-consumer and stable, so re-applying when the
    // resolved object or override set changes is sufficient and cheap.
  }, [object, overrides, entries]);

  // `surface_material_override/0` on an override node needs an ExtResource
  // resolved and a `.tres` loaded, which the synchronous mutation above cannot
  // do — so each one mounts its own slot component instead. This is what
  // retextures the Truck Town landscape.
  const materialOverrides = useGlbMaterialOverrides(object, entries, overrides);

  // Tie each internal GLB object to a tree path so the SceneTreeViewer
  // can select (gizmo) + hide individual nodes. We walk THIS rendered clone
  // with the same relPath scheme the tree uses, then register each object and
  // drive its visibility from the hidden-paths set.
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

  // The objects an override node hides. `applyGlbNodeOverrides` writes
  // `visible` during render, but the tree's hidden-paths effect below assigns
  // EVERY entry's `visible` unconditionally and runs after it — so an authored
  // `visible = false` would be switched straight back on. The two write the
  // same field, so they have to be resolved in one place.
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

  // --- GLB animation driver (selection-driven, ADR-0012) ---------------
  // Godot parity: a GLB's clips live on an `AnimationPlayer` node in the
  // hierarchy (a child of the imported root), not on the root itself. The tree
  // synthesises that node (glbSceneRootChildren) when the GLB carries clips, so
  // the driver activates when THAT child path — not the GLB root — is selected.
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

  // Per-driver: GLB uses a full-subtree snapshot (poseSnapshot.ts) because
  // skeletal/blended clips touch arbitrary bones. AnimationPlayer uses a
  // track-derived snapshot with Euler-order reorder instead.
  const snapshotRef = useRef<PoseSnapshot[]>([]);
  const restore = useCallback(() => restoreSnapshot(snapshotRef.current), []);

  const { mixerRef, actionsRef } = useAnimationDriverMount({
    // Pass the loaded object always so the AnimationDriverRegistry entry is
    // published whenever clips are available — regardless of selection — and
    // an AnimationTree whose `anim_player` resolves here can root its blended
    // mixer without requiring the user to have selected the player first.
    // The mixer build is separately gated on isActive inside the hook.
    object: object ?? null,
    clips,
    // The driver's registry key is the synthesised AnimationPlayer path, not
    // the GLB root — so an AnimationTree resolving `anim_player` to this path
    // finds the correct object + clips.
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

  // An inactive driver is forced to 'stopped' so it never touches the scene
  // (and restores the authored pose when it loses selection). Native glTF
  // clips just loop by default — no Godot loop_mode to honour — unless the
  // preview loop override forces a single clamped pass instead.
  const effectiveState: PlayState = isActive ? transport.playState : 'stopped';
  usePlaybackLoop({
    playState: effectiveState,
    selectedClip: isActive ? transport.selectedClip : null,
    transportTime: transport.time,
    speedScale: transport.playbackSpeed,
    mixerRef,
    actionsRef,
    // Native glTF clips have no Godot loop_mode — their authored default is
    // an infinite repeat, so that's what 'auto' (and 'loop') resolve to.
    configureAction: (action) =>
      applyLoopOverride(action, transport.loopOverride, LOOP_REPEAT_SETTINGS),
    reconfigureKey: transport.loopOverride,
    reportTime: transport.reportTime,
    restore,
  });

  // `children` is the dispatched subtree the host scene parents under this
  // GLB root (Godot parents an instanced scene's extra nodes to its root
  // node). It does not depend on the GLB resolving, so every branch renders
  // it — otherwise a slow or missing .glb silently deletes those nodes too.
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
  // useResource already clones GLB Object3D per consumer to satisfy
  // three.js's "Object3D can only have one parent" invariant, so we
  // mount the returned ref directly via <primitive>.
  return (
    <primitive object={object}>
      {materialOverrides}
      {children}
    </primitive>
  );
}

/**
 * One `<GlbSurfaceMaterialOverride>` per override node that carries a
 * `surface_material_override/0`, targeted at the GLB object its path names.
 *
 * The path resolution is `matchGlbTarget`'s, the same one the transform/layers
 * overrides use, so a Godot path and a three path that disagree about
 * importer-synthesised levels still land on the same mesh.
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

      // A grafted override's ids belong to the scene that AUTHORED it, which is
      // the outer one — not the sub-scene whose provider it now renders under.
      // Both pools travel together, so a SubResource material override resolves
      // there too rather than against whatever the ambient scope happens to
      // hold — see `AuthoredResourceScope`.
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
