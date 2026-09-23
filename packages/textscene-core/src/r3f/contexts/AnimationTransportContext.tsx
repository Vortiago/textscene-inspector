/**
 * The scene's play, pause and scrub state, shared by the AnimationPlayer
 * component and the Animation tab. It starts stopped, so a loaded scene shows
 * its authored pose (ADR-0011). It tracks one registered player.
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
 * The preview loop override: 'auto' keeps the authored `loop_mode`, or a GLB's
 * infinite repeat. 'loop' forces an infinite repeat, 'once' one clamped pass.
 */
export type LoopOverride = 'auto' | 'loop' | 'once';

export interface PlayerRegistration {
  /** Clip names the player owns, in authored order. */
  clips: string[];
  /** Clip name → duration in seconds. */
  durations: Record<string, number>;
  /** The clip selected on registration, else the first. */
  autoplay?: string;
}

export interface AnimationTransport {
  clips: string[];
  selectedClip: string | null;
  /** The player's `autoplay` clip, which the selector marks. */
  autoplayClip: string | null;
  /**
   * True while a selected AnimationPlayer is registered. It decides the
   * Animation tab, instanced players included.
   */
  hasPlayer: boolean;
  playState: PlayState;
  /** Playhead position in seconds. */
  time: number;
  /** The selected clip's duration, 0 when none. */
  duration: number;
  /** A preview rate multiplier on top of the authored `speed_scale`. It resets to 1 on registration. */
  playbackSpeed: number;
  setPlaybackSpeed(speed: number): void;
  /** The preview loop override. It resets to 'auto' on player registration. */
  loopOverride: LoopOverride;
  setLoopOverride(mode: LoopOverride): void;
  /** Registers the scene's AnimationPlayer and returns the cleanup. */
  registerPlayer(registration: PlayerRegistration): () => void;
  play(): void;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  selectClip(name: string): void;
  /**
   * Reports the playhead for the scrubber, throttled to REPORT_THROTTLE_MS.
   * `{ immediate: true }` flushes the exact value, so the readout on pause is
   * not stale. The stop edge relies on `stop()` resetting to 0.
   */
  reportTime(time: number, options?: { immediate?: boolean }): void;
}

/** 10 Hz reads as smooth for a scrubber without a re-render of every consumer each frame. */
const REPORT_THROTTLE_MS = 100;

const RESET_CLIP = 'RESET';

/** The default clip: autoplay, else the first non-RESET clip, else the first clip, else none. */
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
    // A new player starts neutral, so no override from the last player applies.
    // Registration and unregistration share one reset, so no edge leaks.
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

  // A zero, negative or non-finite speed would freeze or reverse playback silently.
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

  // Called every frame while playing. The throttle keeps the other consumers,
  // the mixer-owning component above all, from re-rendering 60 times a second.
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
