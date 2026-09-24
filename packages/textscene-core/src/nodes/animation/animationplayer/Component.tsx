/**
 * <AnimationPlayer>, an invisible node that drives sibling objects. Its empty group keeps it in the
 * tree, and its THREE.AnimationMixer, rooted at `root_node` (ADR-0011), plays the resolved clips
 * under the scene's AnimationTransport, binding KeyframeTracks by name-path. It loads stopped, and
 * stopping restores the transforms captured at mount.
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
import { buildClip, loopSettingsFor, resolveTrackBinding } from './clipBuilder';
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

  // Selection-driven (ADR-0012): this player owns the transport only while it
  // is the node selected in the tree.
  const nodePath = useNodePath();
  const selectedNodePath = useOptionalSelection()?.selectedNodePath ?? null;
  const isSelected = nodePath !== null && nodePath === selectedNodePath;

  // AnimationMixer.active gates everything: `seek_internal` returns on `!active`
  // (animation_player.cpp:664), refusing this transport's scrub as well as the process callback
  // (animation_mixer.cpp:446-455). So an inactive player leaves every target at its authored value
  // and builds no mixer.
  const isDriving = isSelected && properties.active;

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

  // A callback ref, so state updates when the group mounts. The mixer root resolves from the group
  // (root_node may be a sibling), and useAnimationDriverMount needs a reactive value, not a ref
  // read inside useMemo.
  const [mountedGroup, setMountedGroup] = useState<Group | null>(null);
  const groupCallbackRef = useCallback((group: Group | null) => {
    setMountedGroup(group);
  }, []);

  // Per-driver mixer root: AnimationPlayer resolves through root_node (sibling/
  // ancestor), while GLBSceneRoot roots on the object itself.
  const mixerRoot = useMemo<Object3D | null>(() => {
    if (!mountedGroup) return null;
    return resolveAnimationRoot(mountedGroup, properties.root_node) ?? null;
  }, [mountedGroup, properties.root_node]);

  // Loop modes indexed by clip name; configureAction below closes over the
  // memo (usePlaybackLoop reads the latest closure each frame).
  const loopModes = useMemo(
    () => new Map<string, number>(animations.map((a) => [a.name, a.loopMode])),
    [animations]
  );

  // Godot composes Euler rotations in YXZ order. Reorder each rotation target as soon as the root
  // resolves, whatever the selection, since an AnimationTree can play these clips without the player
  // being active (ADR-0019). This runs before the mount hook, so its snapshot keeps the YXZ order
  // (restoreSnapshot preserves it through Euler.copy).
  useEffect(() => {
    if (mixerRoot) applyGodotEulerOrder(mixerRoot, animations);
  }, [mixerRoot, animations]);

  // Per-driver pose snapshot: track-derived targets + Godot Euler-order reorder.
  // GLBSceneRoot uses the full-subtree poseSnapshot instead.
  const snapshotRef = useRef<Snapshot[]>([]);

  const restore = useCallback(() => restoreSnapshot(snapshotRef.current), []);

  const onMixerBuilt = useCallback(
    (root: Object3D) => {
      snapshotRef.current = snapshotTargets(root, animations);
    },
    [animations]
  );

  const { mixerRef, actionsRef } = useAnimationDriverMount({
    object: mixerRoot,
    clips,
    nodePath,
    // Registration stays on selection: Godot lists an inactive player's animations, and an
    // AnimationTree reading them through `anim_player` is gated by its own active flag (ADR-0019).
    isActive: isSelected,
    buildMixer: isDriving,
    autoplay: properties.autoplay || undefined,
    durations,
    onMixerBuilt,
    restore,
  });

  // A player that is not driving is forced to the 'stopped' state so it never
  // touches the scene (and restores the authored pose when it stops driving).
  const effectiveState: PlayState = isDriving ? transport.playState : 'stopped';
  usePlaybackLoop({
    playState: effectiveState,
    selectedClip: isDriving ? transport.selectedClip : null,
    transportTime: transport.time,
    // The preview speed multiplier stacks on top of the authored
    // speed_scale: it never replaces it.
    speedScale: (properties.speed_scale ?? 1) * transport.playbackSpeed,
    mixerRef,
    actionsRef,
    configureAction: (action, clipName) => {
      // 'auto' keeps the clip's authored Godot loop_mode (through loopSettingsFor).
      const authoredMode = loopModes.get(clipName) ?? 0;
      applyLoopOverride(action, transport.loopOverride, loopSettingsFor(authoredMode));
    },
    reconfigureKey: transport.loopOverride,
    reportTime: transport.reportTime,
    restore,
  });

  // ADR-0016/0017: the THREE mixer drives transforms only, so each frame this samples the selected
  // clip's value-push tracks at the live playhead (`frame` stepped, `modulate`/`size` interpolated)
  // and pushes them through the AnimatedValue registry. Not driving releases the targets (null).
  const valueRegistry = useAnimatedValueRegistry();
  // The selected clip's value-push tracks with target paths resolved once
  // (the player path / root_node / track target are constant for the clip).
  const valueTargets = useMemo(() => {
    if (!isDriving || nodePath === null) return null;
    const clip = animations.find((a) => a.name === transport.selectedClip);
    if (!clip) return null;
    const targets = clip.tracks
      .filter((t) => t.type === 'value' && Object.hasOwn(VALUE_PUSH_PROPERTIES, t.property))
      .map((t) => ({
        path: resolveTargetNodePath(nodePath, properties.root_node, t.targetPath),
        property: t.property,
        keys: t.keys,
        interp: t.interp,
      }));
    return targets.length > 0 ? { clipName: clip.name, targets } : null;
  }, [isDriving, nodePath, animations, transport.selectedClip, properties.root_node]);

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
      const value = Object.hasOwn(VALUE_PUSH_PROPERTIES, property) && VALUE_PUSH_PROPERTIES[property]
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

  // Release the moment this player stops driving (stop, deselect, or a switch to a clip with no
  // value tracks) in an effect, not a frame tick, so the authored values return even when a state
  // change does not tick the loop.
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
 * Resolve a track's target node against the animation root, the object the
 * mixer drives, so the Euler reorder and the base-transform snapshot land on
 * it. Goes through the same `resolveTrackBinding` the track names come from, so
 * the two cannot disagree about which object a path means.
 */
export function resolveTrackTarget(root: Object3D, targetPath: string): Object3D | undefined {
  const binding = resolveTrackBinding(targetPath);
  if (binding.kind === 'root') return root;
  if (binding.kind === 'unbindable') return undefined;
  return root.getObjectByName(binding.name);
}

/**
 * Reorder every rotation-track target to Godot's YXZ Euler order, preserving
 * the current orientation (`Euler.reorder`). Single-axis tracks are unaffected;
 * multi-axis Euler rotations match Godot's composition.
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
