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

import { useEffect, useMemo, useRef } from 'react';
import {
  AnimationMixer,
  Euler,
  Group,
  Object3D,
  Quaternion,
  Vector3,
  type AnimationAction,
  type EulerOrder,
} from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useAnimationTransport, type PlayState } from '../../../r3f/contexts/AnimationTransportContext';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext';
import { usePlaybackLoop } from '../../../r3f/animation/usePlaybackLoop';
import { resolveAnimations, type GodotAnimation } from './animationResolver';
import { buildClip, loopSettingsFor } from './clipBuilder';

/** Godot composes Euler rotations in YXZ order; THREE objects default to XYZ. */
const GODOT_EULER_ORDER: EulerOrder = 'YXZ';
import { resolveAnimationRoot } from './animationRoot';
import type { AnimationPlayerProperties } from './types';

interface Snapshot {
  object: Object3D;
  position: Vector3;
  rotation: Euler;
  quaternion: Quaternion;
  scale: Vector3;
}

export function AnimationPlayer({ node, children }: NodeComponentProps) {
  const properties = node.properties as AnimationPlayerProperties;
  const groupRef = useRef<Group>(null);
  const transport = useAnimationTransport();
  const { internalResources } = useSceneResources();

  // Selection-driven (ADR-0012): this player is "active" — owns the transport
  // and drives its mixer — only while it is the node selected in the tree.
  const nodePath = useNodePath();
  const selectedNodePath = useOptionalSelection()?.selectedNodePath ?? null;
  const isActive = nodePath !== null && nodePath === selectedNodePath;

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const animations = useMemo(
    () => resolveAnimations(properties.libraries, internalResources),
    [properties.libraries, internalResources]
  );

  // Register this player's clips with the scene transport.
  const { registerPlayer } = transport;
  const durations = useMemo(
    () => Object.fromEntries(animations.map((a) => [a.name, a.length])),
    [animations]
  );
  // Register whenever this player is selected — even with no animations, so
  // the Animation tab still appears (and reads "no animations"). Registration
  // is the tab's source of truth, which also covers instanced players that
  // never enter the parse-time `flattenedNodes`.
  useEffect(() => {
    if (!isActive) return;
    return registerPlayer({
      clips: animations.map((a) => a.name),
      durations,
      autoplay: properties.autoplay || undefined,
    });
  }, [isActive, animations, durations, properties.autoplay, registerPlayer]);

  // Build the mixer + actions once the group (hence root_node) is mounted.
  const mixerRef = useRef<AnimationMixer | null>(null);
  const actionsRef = useRef<Map<string, AnimationAction>>(new Map());
  const snapshotRef = useRef<Snapshot[]>([]);
  const loopModesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const group = groupRef.current;
    if (!group || animations.length === 0) return;
    const root = resolveAnimationRoot(group, properties.root_node);
    if (!root) return;

    const mixer = new AnimationMixer(root);
    const actions = new Map<string, AnimationAction>();
    const loopModes = new Map<string, number>();
    for (const animation of animations) {
      const action = mixer.clipAction(buildClip(animation));
      actions.set(animation.name, action);
      loopModes.set(animation.name, animation.loopMode);
    }

    // Godot composes Euler rotations in YXZ order. Reorder each rotation
    // target (orientation-preserving) so per-component `.rotation[x|y|z]`
    // writes compose to the same orientation Godot would produce. Done before
    // the snapshot so the restored rest pose keeps the YXZ order too.
    applyGodotEulerOrder(root, animations);

    mixerRef.current = mixer;
    actionsRef.current = actions;
    loopModesRef.current = loopModes;
    snapshotRef.current = snapshotTargets(root, animations);

    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
      actionsRef.current = new Map();
    };
  }, [animations, properties.root_node]);

  // An inactive player is forced to the 'stopped' state so it never touches
  // the scene (and restores the authored pose when it loses selection).
  const effectiveState: PlayState = isActive ? transport.playState : 'stopped';
  usePlaybackLoop({
    playState: effectiveState,
    selectedClip: isActive ? transport.selectedClip : null,
    transportTime: transport.time,
    speedScale: properties.speed_scale,
    mixerRef,
    actionsRef,
    configureAction: (action, clipName) =>
      configureLoop(action, loopModesRef.current.get(clipName) ?? 0),
    reportTime: transport.reportTime,
    restore: () => restoreSnapshot(snapshotRef.current),
  });

  return (
    <group
      ref={groupRef}
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

function configureLoop(action: AnimationAction, loopMode: number): void {
  const { loop, repetitions, clampWhenFinished } = loopSettingsFor(loopMode);
  action.setLoop(loop, repetitions);
  action.clampWhenFinished = clampWhenFinished;
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
      const object = root.getObjectByName(track.targetPath);
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
      const object = root.getObjectByName(track.targetPath);
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
