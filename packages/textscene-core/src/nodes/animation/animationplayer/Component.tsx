/**
 * <AnimationPlayer>, an invisible node that drives other nodes. Its empty group keeps it in the
 * tree. Each track names its target by scene path, resolved from `root_node` as Godot's `get_node`
 * walks it. It binds that exact object when a driver builds a mixer (ADR-0011). The mixer plays
 * under the scene's AnimationTransport. It loads stopped, and stopping restores what it captured.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { AnimationClip, EulerOrder, Object3D } from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import {
  useAnimationTransport,
  type PlayState,
} from '../../../r3f/contexts/AnimationTransportContext';
import type { BoundClips } from '../../../r3f/contexts/AnimationDriverContext';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext';
import { usePlaybackLoop } from '../../../r3f/animation/usePlaybackLoop';
import { applyLoopOverride } from '../../../r3f/animation/loopOverride';
import { useAnimationDriverMount } from '../../../r3f/animation/useAnimationDriverMount';
import {
  restoreSnapshot,
  snapshotPose,
  type PoseSnapshot,
} from '../../../r3f/animation/poseSnapshot';
import {
  bindClip,
  splitTrackName,
  trackTargetFinder,
  trackTargetPaths,
} from '../../../r3f/animation/trackTargets';
import { useAnimatedValueRegistry } from '../../../r3f/contexts/AnimatedValueContext';
import { useUniqueNamePaths } from '../../../r3f/contexts/ViewportTextureContext';
import { resolveAnimations } from './animationResolver';
import { resolveAnimationRootPath, resolveTrackScenePath } from './animationRoot';
import { buildClip, loopSettingsFor } from './clipBuilder';
import {
  sampleSteppedValue,
  sampleInterpolatedValue,
  VALUE_PUSH_PROPERTIES,
} from './valueTracks';

import type { AnimationPlayerProperties } from './types';

/** Godot composes Euler rotations in YXZ order; THREE objects default to XYZ. */
const GODOT_EULER_ORDER: EulerOrder = 'YXZ';

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

  // The scene path `root_node` names from this player, or null when it leaves the scene.
  // A `%Name` segment reads the table of the node the walk stands on (node.cpp:1930-1938): the
  // player for `root_node`, the Animation root for each Track.
  const playerNames = useUniqueNamePaths(nodePath);
  const rootPath = useMemo(
    () =>
      nodePath === null ? null : resolveAnimationRootPath(nodePath, properties.root_node, playerNames),
    [nodePath, properties.root_node, playerNames]
  );
  const rootNames = useUniqueNamePaths(rootPath);
  const scenePathOf = useCallback(
    (targetPath: string) =>
      rootPath === null ? null : resolveTrackScenePath(rootPath, targetPath, rootNames),
    [rootPath, rootNames]
  );

  // Clip templates, each track named by its target's scene path. `bind` turns them into clips that
  // move the exact objects. GLBSceneRoot uses ready-made glTF clips.
  const clips = useMemo<AnimationClip[]>(
    () => animations.map((a) => buildClip(a, scenePathOf)),
    [animations, scenePathOf]
  );

  const durations = useMemo(
    () => Object.fromEntries(animations.map((a) => [a.name, a.length])),
    [animations]
  );

  // The mixer roots on the scene, the one ancestor of every node a track can name, whether that
  // node nests or escapes its parent (`parentSpaceScope.tsx`). Inside a SubViewport it is the
  // viewport's own scene.
  const mixerRoot = useThree((state) => state.scene);

  // Loop modes indexed by clip name; configureAction below closes over the
  // memo (usePlaybackLoop reads the latest closure each frame).
  const loopModes = useMemo(
    () => new Map<string, number>(animations.map((a) => [a.name, a.loopMode])),
    [animations]
  );

  // `bind` reads the scene as it stands when a driver builds a mixer, this player's or an
  // AnimationTree's (ADR-0019), so it finds every target mounted by then.
  const nodeObjectMap = useOptionalSelection()?.nodeObjectMap ?? null;
  const bind = useCallback((): BoundClips => {
    const targets = new Map<string, Object3D>();
    const findTarget = trackTargetFinder(nodeObjectMap ?? new Map());
    for (const path of trackTargetPaths(clips)) {
      const target = findTarget(path);
      if (target) targets.set(path, target);
    }
    applyGodotEulerOrder(clips, targets);
    return { clips: clips.map((clip) => bindClip(clip, targets)), targets: [...targets.values()] };
  }, [clips, nodeObjectMap]);

  // Per-driver pose snapshot of the bound targets. GLBSceneRoot snapshots its whole subtree instead.
  const snapshotRef = useRef<PoseSnapshot[]>([]);

  const restore = useCallback(() => restoreSnapshot(snapshotRef.current), []);

  const onMixerBuilt = useCallback((targets: Object3D[]) => {
    snapshotRef.current = snapshotPose(targets);
  }, []);

  const { mixerRef, actionsRef } = useAnimationDriverMount({
    object: mixerRoot,
    clips,
    bind,
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
    if (!isDriving) return null;
    const clip = animations.find((a) => a.name === transport.selectedClip);
    if (!clip) return null;
    const targets = clip.tracks
      .filter((t) => t.type === 'value' && Object.hasOwn(VALUE_PUSH_PROPERTIES, t.property))
      .flatMap((t) => {
        const path = scenePathOf(t.targetPath);
        return path === null ? [] : [{ path, property: t.property, keys: t.keys, interp: t.interp }];
      });
    return targets.length > 0 ? { clipName: clip.name, targets } : null;
  }, [isDriving, scenePathOf, animations, transport.selectedClip]);

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
 * Reorder every rotation-track target to Godot's YXZ Euler order, preserving the current orientation
 * (`Euler.reorder`), so multi-axis Euler rotations compose as Godot's do. A rotation template track
 * is named `<path>.rotation[axis]` (`clipBuilder.ts`).
 */
function applyGodotEulerOrder(clips: readonly AnimationClip[], targets: ReadonlyMap<string, Object3D>): void {
  for (const clip of clips) {
    for (const track of clip.tracks) {
      const { path, property } = splitTrackName(track.name);
      if (property.startsWith('.rotation[')) targets.get(path)?.rotation.reorder(GODOT_EULER_ORDER);
    }
  }
}
