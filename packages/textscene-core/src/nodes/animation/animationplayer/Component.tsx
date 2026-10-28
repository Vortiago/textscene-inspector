/**
 * <AnimationPlayer>, an invisible node that drives other nodes. Its empty group keeps it in the
 * tree. Each track names its target by scene path, resolved from `root_node` as Godot's `get_node`
 * walks it. It binds that exact object when a driver builds a mixer (ADR-0011). The mixer plays
 * under the scene's AnimationTransport. It loads stopped, and stopping restores what it captured.
 */

import { useCallback, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { AnimationClip, Object3D } from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useAnimationTransport, type PlayState } from '../../../r3f/contexts/AnimationTransportContext';
import type { BoundClips } from '../../../r3f/contexts/AnimationDriverContext';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext';
import { useIsSelected } from '../../../r3f/hooks/useIsSelected';
import { usePlaybackLoop } from '../../../r3f/animation/usePlaybackLoop';
import { applyLoopOverride, loopSettingsFor } from '../../../r3f/animation/loopOverride';
import { useAnimationDriverMount } from '../../../r3f/animation/useAnimationDriverMount';
import { restoreSnapshot, snapshotPose, type PoseSnapshot } from '../../../r3f/animation/poseSnapshot';
import {
  bindClip,
  splitTrackName,
  trackTargetFinder,
  trackTargetPaths,
} from '../../../r3f/animation/trackTargets';
import { GODOT_EULER_ORDER } from '../../../r3f/animation/restPoseTracks';
import { useAnimatedValueRegistry } from '../../../r3f/contexts/AnimatedValueContext';
import { useAnimatedBonePoses } from '../../../r3f/contexts/AnimatedBonePosesContext';
import { usePushedWrites } from '../../../r3f/animation/usePushedWrites';
import { useUniqueNamePaths } from '../../../r3f/useUniqueNames';
import { resolveLiveEntry } from '../../../r3f/liveSceneTree';
import { useSharedLiveTree } from '../../../r3f/useLiveSceneTree';
import { resolveAnimations } from './animationResolver';
import { resolveAnimationRootPath, resolveTrackScenePath } from './animationRoot';
import { AnimationLoopMode } from '../../../godot/scene/animation.js';
import { buildClip } from './clipBuilder';
import {
  boneCandidatePaths,
  bonesPushedBy,
  splitTracks,
  valuesPushedBy,
  type TrackScene,
} from './drivenTracks';

import type { AnimationPlayerProperties } from './types';

/** Godot composes Euler rotations in YXZ order; THREE objects default to XYZ. */

export function AnimationPlayer({ node, children }: NodeComponentProps) {
  const properties = node.properties as AnimationPlayerProperties;
  const { internalResources } = useSceneResources();

  // Selection-driven (ADR-0012): this player owns the transport only while it
  // is the node selected in the tree.
  const nodePath = useNodePath();
  const isSelected = useIsSelected();

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
    () => (nodePath === null ? null : resolveAnimationRootPath(nodePath, properties.root_node, playerNames)),
    [nodePath, properties.root_node, playerNames]
  );
  const rootNames = useUniqueNamePaths(rootPath);
  const scenePathOf = useCallback(
    (targetPath: string) =>
      rootPath === null ? null : resolveTrackScenePath(rootPath, targetPath, rootNames),
    [rootPath, rootNames]
  );

  // Whether a track path names a Skeleton3D decides if its subname is a bone (`animation_mixer.cpp:795`).
  // Without a scene graph a path with one subname is taken for a bone. The split keys on the
  // answer, not the tree, so a scene that loads elsewhere does not rebuild the mixer.
  const liveTree = useSharedLiveTree();
  const skeletonKey = useMemo(
    () =>
      boneCandidatePaths(animations, scenePathOf)
        .filter(
          (scenePath) =>
            liveTree === null ||
            resolveLiveEntry(scenePath, liveTree.roots, liveTree.ctx)?.node.type === 'Skeleton3D'
        )
        .join('\0'),
    [animations, scenePathOf, liveTree]
  );
  const trackScene = useMemo<TrackScene>(() => {
    const skeletons = new Set(skeletonKey.split('\0'));
    return { scenePathOf, isSkeleton: (scenePath) => skeletons.has(scenePath) };
  }, [scenePathOf, skeletonKey]);
  const driven = useMemo(() => animations.map((a) => splitTracks(a, trackScene)), [animations, trackScene]);

  // Clip templates, each track named by its target's scene path. `bind` turns them into clips that
  // move the exact objects. GLBSceneRoot uses ready-made glTF clips.
  const clips = useMemo<AnimationClip[]>(
    () => driven.map((d) => buildClip(d.mixer, scenePathOf)),
    [driven, scenePathOf]
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
  // AnimationTree's (ADR-0019). A target that mounts later makes the binding stale.
  const nodeObjectMap = useOptionalSelection()?.nodeObjectMap ?? null;
  const bind = useCallback((): BoundClips => {
    const nodeObjects = nodeObjectMap ?? new Map<string, Object3D>();
    const findTarget = trackTargetFinder(nodeObjects);
    const targets = new Map<string, Object3D>();
    const missing: string[] = [];
    for (const path of trackTargetPaths(clips)) {
      const target = findTarget(path);
      if (target) targets.set(path, target);
      else missing.push(path);
    }
    applyGodotEulerOrder(clips, targets);
    return {
      clips: clips.map((clip) => bindClip(clip, targets)),
      targets: [...targets.values()],
      // The registry is live, so a fresh finder sees what has mounted since.
      isStale: () => missing.some((path) => trackTargetFinder(nodeObjects)(path) !== null),
    };
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
      const authoredMode = loopModes.get(clipName) ?? AnimationLoopMode.NONE;
      applyLoopOverride(action, transport.loopOverride, loopSettingsFor(authoredMode));
    },
    reconfigureKey: transport.loopOverride,
    reportTime: transport.reportTime,
    restore,
  });

  // ADR-0016/0017: the THREE mixer drives transforms only. The selected clip's value tracks and bone
  // tracks are sampled at the live playhead each frame and pushed to the registries the nodes listen on.
  const isPlaying = transport.playState === 'playing' || transport.playState === 'paused';
  const selectedClip = useMemo(
    () => (isDriving ? (driven.find((d) => d.name === transport.selectedClip) ?? null) : null),
    [isDriving, driven, transport.selectedClip]
  );
  const valueClip = useMemo(
    () => (selectedClip && selectedClip.values.length > 0 ? valuesPushedBy(selectedClip) : null),
    [selectedClip]
  );
  const boneClip = useMemo(
    () => (selectedClip && selectedClip.bones.length > 0 ? bonesPushedBy(selectedClip) : null),
    [selectedClip]
  );
  usePushedWrites(useAnimatedValueRegistry(), valueClip, isPlaying, actionsRef);
  usePushedWrites(useAnimatedBonePoses(), boneClip, isPlaying, actionsRef);

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
