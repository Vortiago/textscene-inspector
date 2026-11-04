/**
 * Paces the tiled upload to the GPU. A band's write returns on the main thread long
 * before the GPU has consumed it, and the bytes wait in memory shared with the GPU
 * process until it does. Under SwiftShader the GPU of a 3D scene runs about a second
 * behind, so a budget of main-thread time alone would put the whole texture in that
 * memory within a few frames, and a later call would block until the GPU freed some.
 * So at most a window of bands is on its way at once: each frame's bands sit behind a
 * fence and leave the window once the GPU has passed it.
 *
 * A fence the GPU is slow to signal must not stop the upload for good: a window that
 * has neither drained nor taken a band for `STALL_MS` gives up on its oldest frame.
 */

/** A marker behind the commands issued so far. `isDone` never waits for the GPU. */
export interface GpuFence {
  isDone(): boolean;
  /** Frees the marker, passed or not. A disposed fence reads as done. */
  dispose(): void;
}

/** What the tiled upload asks before a frame's bands, and tells once it has written them. */
export interface UploadPacer {
  /** The bands this frame may write. */
  allowance(): number;
  /** This frame wrote `bands` bands. */
  markIssued(bands: number): void;
}

/** No pacing: every frame may write as many bands as its time budget allows. */
export const UNPACED: UploadPacer = { allowance: () => Infinity, markIssued: () => {} };

/**
 * 6 MiB of 2 MiB bands on their way to the GPU at once. Under SwiftShader a write blocked
 * the main thread for 190 to 280 ms in about one 3D scene load in three with 8 MiB
 * outstanding, and in none of 20 with 6 MiB.
 */
const IN_FLIGHT_BANDS = 3;

/**
 * A starved GPU process can leave a fence unsignalled while frames keep ticking, and
 * the texture work never ends. Half a second is long enough that a healthy GPU has
 * drained the window first.
 */
const STALL_MS = 500;

interface IssuedFrame {
  fence: GpuFence;
  bands: number;
}

export class GpuPacer implements UploadPacer {
  /** Oldest first. Written by `markIssued`, trimmed by `allowance` as fences pass. */
  private readonly inFlight: IssuedFrame[] = [];

  /** When the window last drained or took a band, in `now` milliseconds. */
  private lastProgressAt = 0;

  constructor(
    private readonly fence: () => GpuFence,
    private readonly now: () => number = () => performance.now()
  ) {}

  allowance(): number {
    this.dropPassed();
    if (this.isStalled()) this.expireOldest();
    const onTheirWay = this.inFlight.reduce((sum, frame) => sum + frame.bands, 0);
    return Math.max(0, IN_FLIGHT_BANDS - onTheirWay);
  }

  markIssued(bands: number): void {
    this.inFlight.push({ fence: this.fence(), bands });
    this.lastProgressAt = this.now();
  }

  /** Frees every fence still on its way, as the canvas that issued them goes. */
  dispose(): void {
    this.release(this.inFlight.length);
  }

  private isStalled(): boolean {
    return this.inFlight.length > 0 && this.now() - this.lastProgressAt >= STALL_MS;
  }

  /** Gives up on the oldest frame's fence, so the window stays bounded however long the GPU stalls. */
  private expireOldest(): void {
    this.release(1);
    this.lastProgressAt = this.now();
  }

  /** The GPU runs commands in order, so a passed fence has passed every earlier one too. */
  private dropPassed(): void {
    for (let index = this.inFlight.length - 1; index >= 0; index--) {
      if (!this.inFlight[index]!.fence.isDone()) continue;
      this.release(index + 1);
      this.lastProgressAt = this.now();
      return;
    }
  }

  /** Frees the oldest `count` frames' fences and forgets them. */
  private release(count: number): void {
    for (const { fence } of this.inFlight.splice(0, count)) fence.dispose();
  }
}
