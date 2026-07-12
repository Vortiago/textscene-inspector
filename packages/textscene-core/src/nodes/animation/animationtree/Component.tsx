/**
 * <AnimationTree> — an invisible node that DRIVES another driver's clips
 * through a blend tree / state machine (ADR-0019).
 *
 * It renders an empty group (no geometry) so it appears in the scene tree and
 * its children keep their transforms. When it is the selected node AND
 * `active = true` (Godot only processes an active tree), it:
 *   1. resolves `tree_root` into an `AnimNode` graph,
 *   2. evaluates that graph at the authored `parameters/*` state into a blend
 *      program — a static previewer has no game script driving the params,
 *   3. resolves `anim_player` to a registered driver (a GLB animation driver or
 *      AnimationPlayer) and drives its object with weighted actions.
 *
 * Godot's Animation panel has no clip picker for an AnimationTree — it plays
 * from the parameter state — so the transport registers a single read-only
 * entry (the dominant clip) rather than a selectable list. Loads STOPPED;
 * play is user-initiated; stop / deselect restores the authored pose.
 *
 * The per-frame transport-actuation decision is delegated to the pure
 * `stepPlayback` reducer; this component is a thin adapter that actuates the
 * returned command on N weighted actions (the blend program) at once.
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
 * The dominant clip's live playhead, used by the adapter to provide the
 * `liveTime` for `stepPlayback`: `null` means "no live playhead to flush,"
 * never a fabricated `0`. An authored blend program can name a clip absent
 * from the resolved driver's clips — the mount effect's `clips.find` skips
 * it, so `dominant` is set (from `program`, independent of the driver) but
 * `actions` never gained an entry for it. Falling back to `0` there would
 * force the paused readout to snap to zero on the very next playing→paused
 * edge instead of skipping the flush, as if the playhead had actually reached
 * the start.
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

  // Resolve the tree and evaluate it at the authored parameter state. Both are
  // pure and depend only on stable inputs, so the blend program is stable
  // across renders unless the scene/parameters change.
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

  // Honour `active` (Godot only processes an active tree) AND selection-driven
  // transport (ADR-0012): drive only while this is the selected, active node.
  const isActive =
    properties.active && nodePath !== null && nodePath === selectedNodePath;

  // No clip picker (Godot parity): surface the dominant clip as the single
  // transport entry so the Animation tab + scrubber appear while selected.
  const dominant = useMemo(
    () => program.reduce<(typeof program)[number] | null>(
      (best, c) => (best === null || c.weight > best.weight ? c : best),
      null
    ),
    [program]
  );
  // Scrubber length = the LONGEST active clip (a blend can mix clips of
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
  // program clip — only while active (so a deselected tree never builds a mixer
  // or touches the scene). Snapshot the subtree so stop / deselect restores it.
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

  // Thin adapter: build stepPlayback input from refs, call the reducer, then
  // actuate the returned command on N weighted actions (the blend program).
  // Blend weighting stays here — this does NOT merge into usePlaybackLoop
  // (its "kept separate until a second weighted driver" stance stands,
  // per ADR-0011/0014/0015/0019).
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
        // #224: the preview speed multiplier applies here too (it's a global
        // playback-rate control). The loop OVERRIDE does not: a blend program
        // drives N weighted actions at once with per-action timeScale/weight,
        // and Godot itself has no single "loop mode" for a state-machine/blend
        // tree preview to override — there's no one loop setting to force.
        mixer.update(delta * transport.playbackSpeed);
        if (dominant) transport.reportTime(actions.get(dominant.clip)?.time ?? 0);
        break;
      }
      case 'seek': {
        // Re-apply each clip's blend weight on seek — a freshly play()-ed
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
