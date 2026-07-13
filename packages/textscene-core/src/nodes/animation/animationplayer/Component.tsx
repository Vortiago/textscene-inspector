/**
 * <AnimationPlayer> — an invisible node that *drives* sibling objects.
 *
 * It renders an empty group (no geometry of its own) so the node appears in
 * the scene tree and its children keep their transforms. Beyond that it owns
 * a THREE.AnimationMixer rooted at its `root_node` (ADR-0011) and, gated by
 * the scene-level AnimationTransport, plays the resolved clips by binding
 * KeyframeTracks to sibling objects by name-path.
 *
 * Loads STOPPED (authored pose); play is user-initiated. On stop the authored
 * transforms captured at mount are restored.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Euler,
  Group,
  Object3D,
  Quaternion,
  Vector3,
  type AnimationClip,
  type EulerOrder,
} from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import {
  useAnimationTransport,
  type PlayState,
} from '../../../r3f/contexts/AnimationTransportContext';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext';
import { usePlaybackLoop } from '../../../r3f/animation/usePlaybackLoop';
import { applyLoopOverride } from '../../../r3f/animation/loopOverride';
import { useAnimationDriverMount } from '../../../r3f/animation/useAnimationDriverMount';
import { useAnimatedValueRegistry } from '../../../r3f/contexts/AnimatedValueContext';
import { resolveAnimations, type GodotAnimation } from './animationResolver';
import { buildClip, loopSettingsFor } from './clipBuilder';
import {
  sampleSteppedValue,
  sampleInterpolatedValue,
  resolveTargetNodePath,
  VALUE_PUSH_PROPERTIES,
} from './valueTracks';

import { resolveAnimationRoot } from './animationRoot';
import type { AnimationPlayerProperties } from './types';

/** Godot composes Euler rotations in YXZ order; THREE objects default to XYZ. */
const GODOT_EULER_ORDER: EulerOrder = 'YXZ';

interface Snapshot {
  object: Object3D;
  position: Vector3;
  rotation: Euler;
  quaternion: Quaternion;
  scale: Vector3;
}

export function AnimationPlayer({ node, children }: NodeComponentProps) {
  const properties = node.properties as AnimationPlayerProperties;
  const { internalResources } = useSceneResources();

  // Selection-driven (ADR-0012): this player is "active" — owns the transport
  // and drives its mixer — only while it is the node selected in the tree.
  const nodePath = useNodePath();
  const selectedNodePath = useOptionalSelection()?.selectedNodePath ?? null;
  const isActive = nodePath !== null && nodePath === selectedNodePath;

  const transport = useAnimationTransport();

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const animations = useMemo(
    () => resolveAnimations(properties.libraries, internalResources),
    [properties.libraries, internalResources]
  );

  // Build THREE.AnimationClips from the resolved GodotAnimations.
  // Per-driver: AnimationPlayer builds clips from GodotAnimation tracks;
  // GLBSceneRoot uses ready-made glTF clips.
  const clips = useMemo<AnimationClip[]>(
    () => animations.map((a) => buildClip(a)),
    [animations]
  );

  const durations = useMemo(
    () => Object.fromEntries(animations.map((a) => [a.name, a.length])),
    [animations]
  );

  // Track the mounted group via a callback ref so state updates when it mounts.
  // The mixer root is resolved from the group (root_node may be a sibling),
  // and we need a stable reactive value — not a ref read inside useMemo —
  // to feed useAnimationDriverMount.
  const [mountedGroup, setMountedGroup] = useState<Group | null>(null);
  const groupCallbackRef = useCallback((group: Group | null) => {
    setMountedGroup(group);
  }, []);

  // Per-driver mixer root: AnimationPlayer resolves via root_node (sibling/
  // ancestor), while GLBSceneRoot roots on the object itself.
  const mixerRoot = useMemo<Object3D | null>(() => {
    if (!mountedGroup) return null;
    return resolveAnimationRoot(mountedGroup, properties.root_node) ?? null;
  }, [mountedGroup, properties.root_node]);

  // Loop modes indexed by clip name, kept in a ref so configureAction reads
  // the latest value without causing a re-render.
  const loopModesRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const next = new Map<string, number>();
    for (const animation of animations) next.set(animation.name, animation.loopMode);
    loopModesRef.current = next;
  }, [animations]);

  // Per-driver pose snapshot: track-derived targets + Godot Euler-order reorder.
  // GLBSceneRoot uses the full-subtree poseSnapshot instead.
  const snapshotRef = useRef<Snapshot[]>([]);

  const restore = useCallback(() => restoreSnapshot(snapshotRef.current), []);

  const onMixerBuilt = useCallback(
    (root: Object3D) => {
      // Reorder rotation targets before snapshotting so the rest pose keeps
      // the YXZ order that the clip's per-component writes expect.
      applyGodotEulerOrder(root, animations);
      snapshotRef.current = snapshotTargets(root, animations);
    },
    [animations]
  );

  const { mixerRef, actionsRef } = useAnimationDriverMount({
    object: mixerRoot,
    clips,
    nodePath,
    isActive,
    autoplay: properties.autoplay || undefined,
    durations,
    onMixerBuilt,
    restore,
  });

  // An inactive player is forced to the 'stopped' state so it never touches
  // the scene (and restores the authored pose when it loses selection).
  const effectiveState: PlayState = isActive ? transport.playState : 'stopped';
  usePlaybackLoop({
    playState: effectiveState,
    selectedClip: isActive ? transport.selectedClip : null,
    transportTime: transport.time,
    // #224: the preview speed multiplier stacks on top of the authored
    // speed_scale — it never replaces it.
    speedScale: (properties.speed_scale ?? 1) * transport.playbackSpeed,
    mixerRef,
    actionsRef,
    configureAction: (action, clipName) => {
      // 'auto' keeps the clip's authored Godot loop_mode (via loopSettingsFor).
      const authoredMode = loopModesRef.current.get(clipName) ?? 0;
      applyLoopOverride(action, transport.loopOverride, loopSettingsFor(authoredMode));
    },
    reconfigureKey: transport.loopOverride,
    reportTime: transport.reportTime,
    restore,
  });

  // ADR-0016/0017: non-transform value tracks can't go through the THREE mixer
  // (it drives transforms only). Sample the selected clip's value-push tracks
  // each frame at the live playhead — `frame` stepped, `modulate`/`size`
  // interpolated — and push to the target via the AnimatedValue registry;
  // release the targets (null) whenever this player isn't driving.
  const valueRegistry = useAnimatedValueRegistry();
  // The selected clip's value-push tracks with target paths resolved once
  // (the player path / root_node / track target are constant for the clip).
  const valueTargets = useMemo(() => {
    if (!isActive || nodePath === null) return null;
    const clip = animations.find((a) => a.name === transport.selectedClip);
    if (!clip) return null;
    const targets = clip.tracks
      .filter((t) => t.type === 'value' && t.property in VALUE_PUSH_PROPERTIES)
      .map((t) => ({
        path: resolveTargetNodePath(nodePath, properties.root_node, t.targetPath),
        property: t.property,
        keys: t.keys,
        interp: t.interp,
      }));
    return targets.length > 0 ? { clipName: clip.name, targets } : null;
  }, [isActive, nodePath, animations, transport.selectedClip, properties.root_node]);

  // Owned (path, property) pairs currently driven, keyed by `${path}:${property}`.
  const ownedValues = useRef<Map<string, { path: string; property: string }>>(new Map());
  const releaseOwnedValues = useCallback(() => {
    const owned = ownedValues.current;
    if (owned.size === 0) return;
    owned.forEach(({ path, property }) => valueRegistry.set(path, property, null));
    owned.clear();
  }, [valueRegistry]);

  useFrame(() => {
    const action = valueTargets ? actionsRef.current.get(valueTargets.clipName) : undefined;
    const playing = transport.playState === 'playing' || transport.playState === 'paused';
    if (!valueTargets || !playing || !action) {
      releaseOwnedValues(); // clip switched away / stopped while the loop runs
      return;
    }
    // Read the LIVE mixer playhead (advanced by usePlaybackLoop earlier this
    // frame), not the React-state transport.time which lags the useFrame closure.
    const owned = ownedValues.current;
    const next = new Map<string, { path: string; property: string }>();
    for (const { path, property, keys, interp } of valueTargets.targets) {
      const value = VALUE_PUSH_PROPERTIES[property]
        ? sampleInterpolatedValue(keys, action.time, interp)
        : [sampleSteppedValue(keys, action.time)];
      valueRegistry.set(path, property, value);
      next.set(`${path}:${property}`, { path, property });
    }
    owned.forEach((entry, key) => {
      if (!next.has(key)) valueRegistry.set(entry.path, entry.property, null);
    });
    ownedValues.current = next;
  });

  // Release the moment this player stops driving — stop, deselect, or a clip
  // switch to one with no value tracks — via an effect (not a frame tick) so the
  // authored values return immediately even when state changes don't tick the loop.
  useEffect(() => {
    const driving =
      !!valueTargets && (transport.playState === 'playing' || transport.playState === 'paused');
    if (!driving) releaseOwnedValues();
  }, [valueTargets, transport.playState, releaseOwnedValues]);
  useEffect(() => releaseOwnedValues, [releaseOwnedValues]); // release on unmount

  return (
    <group
      ref={groupCallbackRef}
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      userData={{ nodeType: 'AnimationPlayer' }}
    >
      {children}
    </group>
  );
}

/**
 * Resolve a track's target node against the animation root. A `.` targetPath
 * (Godot `NodePath(".")`) is the root itself — `getObjectByName(".")` would miss
 * it (no child is named `.`), so map it to the root directly.
 */
export function resolveTrackTarget(root: Object3D, targetPath: string): Object3D | undefined {
  return targetPath === '.' ? root : root.getObjectByName(targetPath);
}

/**
 * Reorder every rotation-track target to Godot's YXZ Euler order, preserving
 * the current orientation (`Euler.reorder`). Single-axis tracks are unaffected;
 * multi-axis Euler rotations now match Godot's composition.
 */
function applyGodotEulerOrder(root: Object3D, animations: GodotAnimation[]): void {
  const seen = new Set<string>();
  for (const animation of animations) {
    for (const track of animation.tracks) {
      if (track.property !== 'rotation' && track.property !== 'rotation_degrees') continue;
      if (seen.has(track.targetPath)) continue;
      seen.add(track.targetPath);
      const object = resolveTrackTarget(root, track.targetPath);
      if (object) object.rotation.reorder(GODOT_EULER_ORDER);
    }
  }
}

function snapshotTargets(root: Object3D, animations: GodotAnimation[]): Snapshot[] {
  const seen = new Set<string>();
  const snapshots: Snapshot[] = [];
  for (const animation of animations) {
    for (const track of animation.tracks) {
      if (seen.has(track.targetPath)) continue;
      seen.add(track.targetPath);
      const object = resolveTrackTarget(root, track.targetPath);
      if (!object) continue;
      snapshots.push({
        object,
        position: object.position.clone(),
        rotation: object.rotation.clone(),
        quaternion: object.quaternion.clone(),
        scale: object.scale.clone(),
      });
    }
  }
  return snapshots;
}

function restoreSnapshot(snapshots: Snapshot[]): void {
  for (const snap of snapshots) {
    snap.object.position.copy(snap.position);
    snap.object.rotation.copy(snap.rotation);
    snap.object.quaternion.copy(snap.quaternion);
    snap.object.scale.copy(snap.scale);
  }
}
