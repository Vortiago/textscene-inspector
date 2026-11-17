/** Godot's default of `rendering/limits/time/time_rollover_secs` (`rendering_server.cpp:3700`). */
export const DEFAULT_TIME_ROLLOVER_SECONDS = 3600;

/** `TIME` as `RendererCompositorRD::begin_frame` moves it (`renderer_compositor_rd.cpp:107`). */
export class ShaderClock {
  /** A double, as Godot's `time` is. Written only by `advance` and `set`. */
  private seconds = 0;

  constructor(private readonly rolloverSeconds = DEFAULT_TIME_ROLLOVER_SECONDS) {}

  get time(): number {
    return this.seconds;
  }

  /** A frame of `step` seconds, before the frame draws: Godot's `Math::fmod`, which `%` is for doubles. */
  advance(step: number): number {
    return this.set(this.seconds + step);
  }

  set(seconds: number): number {
    this.seconds = seconds % this.rolloverSeconds;
    return this.seconds;
  }
}

/** The previewer's playback controls, as `AnimationTransportContext` holds them. */
export interface Playback {
  /** False in a scene with no AnimationPlayer, which has no controls. */
  readonly hasPlayer: boolean;
  readonly playState: 'stopped' | 'playing' | 'paused';
  /** The playhead in seconds. */
  readonly playhead: number;
  /** How many seeks the controls have made, so a seek to the playhead it is at still reads as one. */
  readonly seeks: number;
}

/** `TIME` under the playback controls, where Godot's keeps running (ADR-0083). */
export class PlaybackShaderTime {
  /** The seeks of the last frame, so a frame after a new seek sets `TIME` to the playhead. */
  private lastSeeks: number | undefined;

  constructor(private readonly clock: ShaderClock) {}

  /** `TIME` for a frame of `step` seconds. */
  frame(playback: Playback, step: number): number {
    const hasSought = this.lastSeeks !== undefined && playback.seeks !== this.lastSeeks;
    this.lastSeeks = playback.seeks;
    if (!playback.hasPlayer) return this.clock.advance(step);
    if (playback.playState === 'stopped') return this.clock.set(0);
    if (hasSought) return this.clock.set(playback.playhead);
    return playback.playState === 'playing' ? this.clock.advance(step) : this.clock.time;
  }
}
