/**
 * Times a frame's GPU work per render step with `EXT_disjoint_timer_query_webgl2`. WebGL runs one
 * `TIME_ELAPSED` query at a time, so a nested step ends its parent's query and starts its own: each
 * query times one segment of one step's own work, and the frame's segments sum to its GPU time.
 */

import type { StepKey } from './frameStats.js';

const TIMER_EXTENSION = 'EXT_disjoint_timer_query_webgl2';

interface TimerQueryExtension {
  readonly TIME_ELAPSED_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
}

/**
 * A driver resolves a query two or three frames on. A frame still unresolved after this many has
 * lost its results, as to a lost context, so its queries go back to the pool.
 */
const MAX_PENDING_FRAMES = 10;

interface Segment {
  readonly step: StepKey;
  readonly query: WebGLQuery;
}

export class GpuTimer {
  private running: Segment | null = null;
  private frame: Segment[] = [];
  /** Closed frames whose results have not all arrived, oldest first. */
  private readonly pending: Segment[][] = [];
  private readonly pool: WebGLQuery[] = [];

  /** Null when the context offers no timer query. */
  static create(gl: WebGL2RenderingContext): GpuTimer | null {
    const ext = gl.getExtension(TIMER_EXTENSION) as TimerQueryExtension | null;
    return ext ? new GpuTimer(gl, ext) : null;
  }

  private constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly ext: TimerQueryExtension
  ) {}

  /** Ends the running segment and starts one for `step`. */
  switchTo(step: StepKey): void {
    this.endSegment();
    const query = this.pool.pop() ?? this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    this.running = { step, query };
    this.frame.push(this.running);
  }

  endFrame(): void {
    this.endSegment();
    if (this.frame.length === 0) return;
    this.pending.push(this.frame);
    this.frame = [];
    if (this.pending.length > MAX_PENDING_FRAMES) this.recycle(this.pending.shift()!);
  }

  /**
   * Hands each segment of every frame whose results have all arrived to `onSegment`, oldest first,
   * and answers how many frames that was. A disjoint operation, such as a clock change, voids every
   * result in flight, so those frames are dropped.
   */
  collect(onSegment: (step: StepKey, ns: number) => void): number {
    if (this.gl.getParameter(this.ext.GPU_DISJOINT_EXT)) {
      for (const frame of this.pending.splice(0)) this.recycle(frame);
      return 0;
    }
    let frames = 0;
    while (this.pending.length > 0 && this.hasArrived(this.pending[0]!)) {
      const frame = this.pending.shift()!;
      for (const { step, query } of frame) {
        onSegment(step, this.gl.getQueryParameter(query, this.gl.QUERY_RESULT) as number);
      }
      this.recycle(frame);
      frames += 1;
    }
    return frames;
  }

  dispose(): void {
    this.endSegment();
    for (const frame of [this.frame, ...this.pending]) this.recycle(frame);
    this.frame = [];
    this.pending.length = 0;
    for (const query of this.pool.splice(0)) this.gl.deleteQuery(query);
  }

  private endSegment(): void {
    if (!this.running) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.running = null;
  }

  /** Queries resolve in order, so a frame whose last query has resolved has resolved whole. */
  private hasArrived(frame: readonly Segment[]): boolean {
    return this.gl.getQueryParameter(frame.at(-1)!.query, this.gl.QUERY_RESULT_AVAILABLE) as boolean;
  }

  private recycle(frame: readonly Segment[]): void {
    for (const { query } of frame) this.pool.push(query);
  }
}
