/**
 * <AnimationTree>: an invisible node that drives another driver's clips through a blend tree or
 * state machine (ADR-0019). It renders an empty group, so it appears in the scene tree and its
 * children keep their transforms. It loads stopped, the user starts play, and stop or deselect
 * restores the authored pose.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AnimationMixer, type AnimationAction } from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import {
  useAnimationTransport,
  type PlayState,
} from '../../../r3f/contexts/AnimationTransportContext';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext';
import { useAnimationDriver } from '../../../r3f/contexts/AnimationDriverContext';
import { stepPlayback } from '../../../r3f/animation/stepPlayback';
import { startAction, seekAction } from '../../../r3f/animation/actionHelpers';
import { snapshotSubtree, restoreSnapshot } from '../../../r3f/animation/poseSnapshot';
import { resolveTreeRoot } from './treeResources';
import { evaluateTree } from './evaluateTree';
import { resolveAnimPlayerPath } from './resolveAnimPlayer';
import type { AnimationTreeProperties } from './types';

/**
 * The dominant clip's live playhead, the `liveTime` for `stepPlayback`. `null` means no live
 * playhead to flush, never a fabricated `0`: a blend program can name a clip the driver lacks, so
 * `dominant` is set but `actions` has no entry. A `0` there would snap the paused readout to zero
 * on the next playing-to-paused edge.
 */
export function dominantActionTime(
  dominant: { clip: string } | null,
  actions: ReadonlyMap<string, AnimationAction>
): number | null {
  if (!dominant) return null;
  return actions.get(dominant.clip)?.time ?? null;
}

export function AnimationTree({ node, children }: NodeComponentProps) {
  const properties = node.properties as AnimationTreeProperties;
  const { internalResources } = useSceneResources();
  const transport = useAnimationTransport();
  const nodePath = useNodePath();
  const selectedNodePath = useOptionalSelection()?.selectedNodePath ?? null;

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  // Resolve the tree and evaluate it at the authored `parameters/*` state, since a static
  // previewer has no game script driving the parameters. Both are pure, so the blend program is
  // stable across renders unless the scene or the parameters change.
  const program = useMemo(() => {
    const root = resolveTreeRoot(properties.tree_root, internalResources);
    return evaluateTree(root, properties.parameters);
  }, [properties.tree_root, properties.parameters, internalResources]);

  // Resolve `anim_player` to a node path and look up the driver there.
  const targetPath = useMemo(
    () => (nodePath === null ? null : resolveAnimPlayerPath(nodePath, properties.anim_player)),
    [nodePath, properties.anim_player]
  );
  const driver = useAnimationDriver(targetPath);

  // Honour `active` (Godot only processes an active tree) and selection-driven
  // transport (ADR-0012): drive only while this is the selected, active node.
  const isActive =
    properties.active && nodePath !== null && nodePath === selectedNodePath;

  // Godot's Animation panel has no clip picker for an AnimationTree, so the dominant clip is the
  // single read-only transport entry, and the Animation tab and scrubber appear while selected.
  const dominant = useMemo(
    () => program.reduce<(typeof program)[number] | null>(
      (best, c) => (best === null || c.weight > best.weight ? c : best),
      null
    ),
    [program]
  );
  // Scrubber length = the longest active clip (a blend can mix clips of
  // different lengths; clamping to the dominant's would cut seeks short).
  // Memoised: the transport re-renders this component every frame while playing
  // (reportTime → setTime), so avoid re-scanning the clip list then.
  const scrubberDuration = useMemo(() => {
    if (!driver) return 0;
    let max = 0;
    for (const { clip } of program) {
      const duration = driver.clips.find((c) => c.name === clip)?.duration ?? 0;
      if (duration > max) max = duration;
    }
    return max;
  }, [program, driver]);

  const { registerPlayer } = transport;
  useEffect(() => {
    if (!isActive) return;
    return registerPlayer({
      clips: dominant ? [dominant.clip] : [],
      durations: dominant ? { [dominant.clip]: scrubberDuration } : {},
    });
  }, [isActive, dominant, scrubberDuration, registerPlayer]);

  // Build a mixer rooted on the driver's object with one weighted action per
  // program clip, only while active, so a deselected tree never touches the scene.
  // Snapshot the subtree so stop or deselect restores it.
  const mixerRef = useRef<AnimationMixer | null>(null);
  const actionsRef = useRef<Map<string, AnimationAction>>(new Map());
  const snapshotRef = useRef<ReturnType<typeof snapshotSubtree>>([]);
  useEffect(() => {
    if (!isActive || !driver || program.length === 0) return;
    const { object, clips } = driver;
    const mixer = new AnimationMixer(object);
    const actions = new Map<string, AnimationAction>();
    for (const { clip } of program) {
      const found = clips.find((c) => c.name === clip);
      if (!found) continue;
      actions.set(clip, mixer.clipAction(found));
    }
    mixerRef.current = mixer;
    actionsRef.current = actions;
    snapshotRef.current = snapshotSubtree(object);
    return () => {
      mixer.stopAllAction();
      restoreSnapshot(snapshotRef.current);
      mixerRef.current = null;
      actionsRef.current = new Map();
      snapshotRef.current = [];
    };
  }, [isActive, driver, program]);

  // Thin adapter: build the stepPlayback input from refs, call the pure reducer, then actuate
  // its command on N weighted actions. Blend weighting stays here, out of usePlaybackLoop, until
  // a second weighted driver exists (ADR-0011/0014/0015/0019).
  const prevStateRef = useRef<PlayState>('stopped');
  const prevTimeRef = useRef(0);
  useFrame((_, delta) => {
    const mixer = mixerRef.current;
    const state: PlayState = isActive ? transport.playState : 'stopped';
    if (!mixer) {
      prevStateRef.current = state;
      return;
    }
    const actions = actionsRef.current;

    const liveTime = dominantActionTime(dominant, actions);
    const step = stepPlayback({
      prevState: prevStateRef.current,
      state,
      prevTime: prevTimeRef.current,
      transportTime: transport.time,
      liveTime,
      clipChanged: false,
    });

    if (step.flushTime && liveTime !== null) {
      transport.reportTime(liveTime, { immediate: true });
    }

    switch (step.command) {
      case 'ensure-playing': {
        for (const { clip, weight, timeScale } of program) {
          const action = actions.get(clip);
          if (!action) continue;
          if (!action.isRunning()) {
            // Weights/time scales are static (authored parameter state), so set
            // them once when the action starts rather than every frame.
            startAction(action, { weight, timeScale });
          }
        }
        // The global preview speed multiplier applies here too. The loop override does not: a
        // blend program drives N weighted actions with their own timeScale and weight, and Godot
        // has no single loop mode for a blend tree or state machine preview.
        mixer.update(delta * transport.playbackSpeed);
        if (dominant) transport.reportTime(actions.get(dominant.clip)?.time ?? 0);
        break;
      }
      case 'seek': {
        // Re-apply each clip's blend weight on seek: a freshly play()-ed
        // action defaults to weight 1, which would over-blend the pose.
        for (const { clip, weight, timeScale } of program) {
          const action = actions.get(clip);
          if (!action) continue;
          seekAction(action, transport.time, { weight, timeScale });
        }
        mixer.update(0);
        break;
      }
      case 'hold-paused': {
        for (const action of actions.values()) action.paused = true;
        break;
      }
      case 'stop-and-restore': {
        mixer.stopAllAction();
        restoreSnapshot(snapshotRef.current);
        break;
      }
      case 'none': {
        break;
      }
    }

    prevStateRef.current = state;
    prevTimeRef.current = transport.time;
  });

  return (
    <group
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      userData={{ nodeType: 'AnimationTree' }}
    >
      {children}
    </group>
  );
}
