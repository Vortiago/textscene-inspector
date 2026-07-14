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
import { applyGlbNodeOverrides } from './glbNodeOverrides';
import { flattenGlbObjects, GLB_ANIMATION_PLAYER_NAME } from './glbHierarchy';
import { useAnimationTransport, type PlayState } from '../../contexts/AnimationTransportContext';
import { useNodePath } from '../../contexts/NodePathContext';
import { useOptionalSelection } from '../../contexts/SelectionContext';
import { usePlaybackLoop } from '../../animation/usePlaybackLoop';
import { applyLoopOverride, LOOP_REPEAT_SETTINGS } from '../../animation/loopOverride';
import { snapshotSubtree, restoreSnapshot, type PoseSnapshot } from '../../animation/poseSnapshot';
import { useAnimationDriverMount } from '../../animation/useAnimationDriverMount';
import { joinPath } from '../../../utils/nodePath';

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

  // WI-D: tie each internal GLB object to a tree path so the SceneTreeViewer
  // can select (gizmo) + hide individual nodes. We walk THIS rendered clone
  // with the same relPath scheme the tree uses, then register each object and
  // drive its visibility from the hidden-paths set.
  const selection = useOptionalSelection();
  const nodePath = useNodePath();
  const entries = useMemo(() => (object ? flattenGlbObjects(object) : []), [object]);

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

  const hiddenNodePaths = selection?.hiddenNodePaths;
  useEffect(() => {
    if (nodePath === null) return;
    for (const { relPath, object: obj } of entries) {
      obj.visible = !(hiddenNodePaths?.has(joinPath(nodePath, relPath)) ?? false);
    }
  }, [entries, nodePath, hiddenNodePaths]);

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
  // preview loop override (#224) forces a single clamped pass instead.
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
