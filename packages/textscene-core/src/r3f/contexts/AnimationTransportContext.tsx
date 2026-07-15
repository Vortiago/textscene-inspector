/**
 * Scene-level animation transport — the single source of truth for
 * play/pause/scrub, shared between the in-canvas AnimationPlayer Component
 * (which owns the THREE.AnimationMixer) and the DOM Animation dock tab.
 *
 * Starts STOPPED so a freshly loaded scene shows its authored pose (ADR-0011 /
 * CONTEXT "Animation transport"); play is user-initiated. Slice-1 tracks a
 * single registered player; multi-player is deferred.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type PlayState = 'stopped' | 'playing' | 'paused';

/**
 * Preview-only loop override: 'auto' respects each clip's authored
 * loop behavior (Godot `loop_mode` for AnimationPlayer clips; a GLB's
 * default infinite repeat). 'loop' forces an infinite repeat regardless of
 * authoring; 'once' forces a single clamped pass. Resets to 'auto' whenever
 * a new player registers so a stale override never silently applies to an
 * unrelated clip.
 */
export type LoopOverride = 'auto' | 'loop' | 'once';

export interface PlayerRegistration {
  /** Clip names the player owns, in authored order. */
  clips: string[];
  /** Clip name → duration in seconds. */
  durations: Record<string, number>;
  /** Clip to pre-select on registration (`autoplay`); falls back to the first. */
  autoplay?: string;
}

export interface AnimationTransport {
  clips: string[];
  selectedClip: string | null;
  /** The player's `autoplay` clip, if any — marked in the selector. */
  autoplayClip: string | null;
  /**
   * True while an AnimationPlayer is registered (selected). Drives Animation
   * tab visibility — works for instanced players that aren't in the parse-time
   * `flattenedNodes`, since registration is the render-time source of truth.
   */
  hasPlayer: boolean;
  playState: PlayState;
  /** Playhead position in seconds. */
  time: number;
  /** Duration of the selected clip (0 when none). */
  duration: number;
  /**
   * Preview playback rate multiplier, applied ON TOP OF any
   * authored `speed_scale` (AnimationPlayer) or GLB default (1x). Resets to
   * 1 on player registration. Defaults to 1 (no change from authored speed).
   */
  playbackSpeed: number;
  setPlaybackSpeed(speed: number): void;
  /** Preview loop override; resets to 'auto' on player registration. */
  loopOverride: LoopOverride;
  setLoopOverride(mode: LoopOverride): void;
  /** Register the scene's AnimationPlayer; returns an unregister cleanup. */
  registerPlayer(registration: PlayerRegistration): () => void;
  play(): void;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  selectClip(name: string): void;
  /**
   * Component → transport: report the live playhead for the scrubber.
   * Throttled to REPORT_THROTTLE_MS — the driver's useFrame loop
   * calls this every rendered frame, and committing React state that often
   * re-renders every AnimationTransport consumer (the mixer-owning
   * Component included) for a value only the scrubber/timecode actually
   * need at high frequency. Pass `{ immediate: true }` to bypass the
   * throttle and flush the exact value now — used on the playing → paused
   * edge so the paused readout isn't stale by up to the throttle window
   * (the stopped edge instead relies on `stop()`'s own reset to 0).
   */
  reportTime(time: number, options?: { immediate?: boolean }): void;
}

/** ~10 Hz — a scrubber/timecode redraw rate that reads as smooth without
 * re-rendering every transport consumer on every rendered animation frame. */
const REPORT_THROTTLE_MS = 100;

const RESET_CLIP = 'RESET';

/** Default selection: autoplay → first non-RESET → first clip → none. */
function defaultClip(reg: PlayerRegistration): string | null {
  if (reg.autoplay && reg.clips.includes(reg.autoplay)) return reg.autoplay;
  return reg.clips.find((c) => c !== RESET_CLIP) ?? reg.clips[0] ?? null;
}

const NO_OP: AnimationTransport = {
  clips: [],
  selectedClip: null,
  autoplayClip: null,
  hasPlayer: false,
  playState: 'stopped',
  time: 0,
  duration: 0,
  playbackSpeed: 1,
  setPlaybackSpeed: () => {},
  loopOverride: 'auto',
  setLoopOverride: () => {},
  registerPlayer: () => () => {},
  play: () => {},
  pause: () => {},
  stop: () => {},
  seek: () => {},
  selectClip: () => {},
  reportTime: () => {},
};

const AnimationTransportContext = createContext<AnimationTransport>(NO_OP);
AnimationTransportContext.displayName = 'AnimationTransportContext';

export function useAnimationTransport(): AnimationTransport {
  return useContext(AnimationTransportContext);
}

export function AnimationTransportProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistration] = useState<PlayerRegistration | null>(null);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [playState, setPlayState] = useState<PlayState>('stopped');
  const [time, setTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeedState] = useState(1);
  const [loopOverride, setLoopOverride] = useState<LoopOverride>('auto');

  const clips = useMemo(() => registration?.clips ?? [], [registration]);
  const hasPlayer = registration !== null;
  const autoplayClip =
    registration?.autoplay && clips.includes(registration.autoplay) ? registration.autoplay : null;
  const duration =
    (selectedClip ? registration?.durations[selectedClip] : undefined) ?? 0;

  const registerPlayer = useCallback((reg: PlayerRegistration) => {
    // A freshly (re)selected player starts neutral — a 2x speed or
    // "once" override left over from a PREVIOUS player would otherwise
    // silently apply to a clip the user never chose that setting for. ONE
    // shared reset for registration and unregistration, so a future
    // per-player preference can't be reset on one edge and leak on the other.
    const resetPlayback = () => {
      setPlayState('stopped');
      setTime(0);
      setPlaybackSpeedState(1);
      setLoopOverride('auto');
    };
    setRegistration(reg);
    setSelectedClip(defaultClip(reg));
    resetPlayback();
    return () => {
      setRegistration(null);
      setSelectedClip(null);
      resetPlayback();
    };
  }, []);

  // Guard against 0/negative/non-finite speeds, which would silently freeze
  // or reverse playback rather than surface as an obvious error.
  const setPlaybackSpeed = useCallback((speed: number) => {
    setPlaybackSpeedState(Number.isFinite(speed) && speed > 0 ? speed : 1);
  }, []);

  const play = useCallback(() => {
    if (selectedClip) setPlayState('playing');
  }, [selectedClip]);

  const pause = useCallback(() => setPlayState('paused'), []);

  const stop = useCallback(() => {
    setPlayState('stopped');
    setTime(0);
  }, []);

  const clampTime = useCallback(
    (t: number) => {
      const max = (selectedClip ? registration?.durations[selectedClip] : undefined) ?? 0;
      return Math.max(0, Math.min(t, max));
    },
    [registration, selectedClip]
  );

  const seek = useCallback((t: number) => setTime(clampTime(t)), [clampTime]);

  const selectClip = useCallback((name: string) => {
    setSelectedClip(name);
    setTime(0);
  }, []);

  // reportTime is called every rendered animation frame (via
  // usePlaybackLoop's useFrame) while playing. Throttling the React-state
  // commit to REPORT_THROTTLE_MS keeps every OTHER AnimationTransport
  // consumer (the mixer-owning Component in particular) from re-rendering
  // 60x/sec for a value it doesn't need at that frequency.
  const lastCommitRef = useRef(0);
  const reportTime = useCallback(
    (t: number, options?: { immediate?: boolean }) => {
      const now = Date.now();
      if (!options?.immediate && now - lastCommitRef.current < REPORT_THROTTLE_MS) return;
      lastCommitRef.current = now;
      setTime(clampTime(t));
    },
    [clampTime]
  );

  const value = useMemo<AnimationTransport>(
    () => ({
      clips,
      selectedClip,
      autoplayClip,
      hasPlayer,
      playState,
      time,
      duration,
      playbackSpeed,
      setPlaybackSpeed,
      loopOverride,
      setLoopOverride,
      registerPlayer,
      play,
      pause,
      stop,
      seek,
      selectClip,
      reportTime,
    }),
    [
      clips,
      selectedClip,
      autoplayClip,
      hasPlayer,
      playState,
      time,
      duration,
      playbackSpeed,
      setPlaybackSpeed,
      loopOverride,
      setLoopOverride,
      registerPlayer,
      play,
      pause,
      stop,
      seek,
      selectClip,
      reportTime,
    ]
  );

  return (
    <AnimationTransportContext.Provider value={value}>
      {children}
    </AnimationTransportContext.Provider>
  );
}
