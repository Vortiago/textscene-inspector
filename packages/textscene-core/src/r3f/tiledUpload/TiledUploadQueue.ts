/**
 * The tiled GPU upload for a large typed-array texture. three uploads a texture
 * whole, in one call, the first time it draws: a 4096² RGBA texture is 64 MiB,
 * which blocked the main thread for 34–435 ms in headless Chromium. This queue
 * allocates the texture's storage empty, then fills it in row bands, a few per
 * frame, so no frame carries the whole upload (ADR-0042).
 */

import * as THREE from 'three';
import { GpuResidency, residencyKey } from './gpuResidency';
import { UNPACED, type UploadPacer } from './gpuPacer';

/** What the queue asks of the GPU, so a test can stand in for it (`webglUploadRenderer.ts`). */
export interface UploadRenderer {
  /** three's own init, which allocates the texture's storage. */
  initTexture(texture: THREE.Texture): void;
  /** Writes rows `[fromRow, toRow)` of `texture`'s own bytes into its storage. */
  writeRows(texture: THREE.Texture, fromRow: number, toRow: number): void;
  /** Builds the mip chain from the filled base level. */
  generateMipmaps(texture: THREE.Texture): void;
}

/** A consumer's place in the queue. A texture whose upload was cancelled must not be drawn. */
export interface TiledUpload {
  /** True once every row is on the GPU; false when the upload was cancelled first. */
  done: Promise<boolean>;
  cancel(): void;
}

/**
 * Bytes a band carries. A 2 MiB band, 128 rows of a 4096-wide texture, took 1.5–5 ms
 * in headless Chromium, so a frame fits several within its budget.
 */
const BAND_BYTES = 2 * 1024 * 1024;

/** The only layout the queue tiles: 8-bit RGBA, as every procedural build writes. */
export const RGBA_BYTES = 4;

/** Rows per band for a texture `width` pixels wide, at least one. */
export function bandRows(width: number): number {
  return Math.max(1, Math.floor(BAND_BYTES / (width * RGBA_BYTES)));
}

/** One consumer waiting on an upload. */
interface Waiter {
  texture: THREE.Texture;
  finish: (uploaded: boolean) => void;
}

interface QueuedUpload {
  /** The texture whose storage the rows fill. */
  texture: THREE.Texture;
  /** three's cache key for `texture`, so a matching clone joins this upload. */
  key: string;
  width: number;
  height: number;
  nextRow: number;
  /** Every consumer of this GPU texture: the one that started it, and matching clones that joined. */
  waiters: Waiter[];
}

export class TiledUploadQueue {
  /** Written by `enqueue`, `tick` and a cancel. The head is the upload in progress. */
  private readonly queue: QueuedUpload[] = [];
  private readonly residency = new GpuResidency();

  constructor(
    private readonly renderer: UploadRenderer,
    private readonly now: () => number = () => performance.now(),
    private readonly pacer: UploadPacer = UNPACED
  ) {}

  /** Whether three's own whole upload would carry more than one band. */
  needsTiling(texture: THREE.Texture): boolean {
    const image = texture.image as { data?: unknown; width?: number; height?: number } | null;
    if (!image || !(image.data instanceof Uint8Array)) return false;
    if (texture.format !== THREE.RGBAFormat || texture.type !== THREE.UnsignedByteType) return false;
    const { width = 0, height = 0 } = image;
    return height > bandRows(width);
  }

  /**
   * Gets `texture` onto the GPU in bands. A clone that matches a GPU texture three
   * already has, or one already uploading, shares it instead of starting another.
   */
  enqueue(texture: THREE.Texture): TiledUpload {
    if (this.residency.isResident(texture)) {
      // `Texture.copy` bumps the shared source's version, so a clone that three first
      // meets at a draw gets the whole image uploaded again, in one call.
      this.initWithoutData(texture);
      this.residency.hold(texture);
      return { done: Promise.resolve(true), cancel: () => {} };
    }
    const key = residencyKey(texture);
    const inFlight = this.queue.find((entry) => entry.texture.source === texture.source && entry.key === key);
    return this.join(inFlight ?? this.start(texture, key), texture);
  }

  /** Allocates `texture` empty now, and queues its rows. */
  private start(texture: THREE.Texture, key: string): QueuedUpload {
    const { width, height } = texture.image as { width: number; height: number };
    this.initWithoutData(texture);
    const entry: QueuedUpload = { texture, key, width, height, nextRow: 0, waiters: [] };
    this.queue.push(entry);
    return entry;
  }

  /**
   * three's own init of `texture`, with `dataReady` cleared for that one synchronous
   * call: it allocates GPU storage, or binds the storage its pair already has, and
   * copies no pixels. The source is shared with every clone of the texture, and
   * nothing else can upload in between.
   */
  private initWithoutData(texture: THREE.Texture): void {
    texture.source.dataReady = false;
    try {
      this.renderer.initTexture(texture);
    } finally {
      texture.source.dataReady = true;
    }
  }

  private join(entry: QueuedUpload, texture: THREE.Texture): TiledUpload {
    let finish: (uploaded: boolean) => void = () => {};
    const done = new Promise<boolean>((resolve) => {
      finish = resolve;
    });
    const waiter: Waiter = { texture, finish };
    entry.waiters.push(waiter);
    return { done, cancel: () => this.leave(entry, waiter) };
  }

  /**
   * Copies bands until `budgetMs` is spent or the pacer's allowance is used, and at
   * least one when the pacer allows any. Returns how many it copied.
   */
  tick(budgetMs: number): number {
    if (this.queue.length === 0) return 0;
    const allowance = this.pacer.allowance();
    const startedAt = this.now();
    let copied = 0;
    while (copied < allowance) {
      const entry = this.queue[0];
      if (!entry) break;
      this.copyBand(entry);
      copied++;
      if (this.now() - startedAt >= budgetMs) break;
    }
    if (copied > 0) this.pacer.markIssued(copied);
    return copied;
  }

  private copyBand(entry: QueuedUpload): void {
    const { width, height, texture } = entry;
    const fromRow = entry.nextRow;
    const toRow = Math.min(height, fromRow + bandRows(width));
    this.renderer.writeRows(texture, fromRow, toRow);
    entry.nextRow = toRow;
    if (toRow < height) return;
    if (texture.generateMipmaps) this.renderer.generateMipmaps(texture);
    this.complete(entry);
  }

  private complete(entry: QueuedUpload): void {
    this.queue.splice(this.queue.indexOf(entry), 1);
    for (const { texture, finish } of entry.waiters) {
      if (texture !== entry.texture) this.initWithoutData(texture);
      this.residency.hold(texture);
      finish(true);
    }
  }

  /** One consumer stops waiting. The upload stops only when none is left. */
  private leave(entry: QueuedUpload, waiter: Waiter): void {
    const index = entry.waiters.indexOf(waiter);
    if (index < 0 || !this.queue.includes(entry)) return;
    entry.waiters.splice(index, 1);
    waiter.finish(false);
    // The rows go on while a remaining consumer draws the texture they fill.
    if (entry.waiters.some(({ texture }) => texture === entry.texture)) return;
    const [next] = entry.waiters;
    if (!next) {
      this.queue.splice(this.queue.indexOf(entry), 1);
      return;
    }
    // A remaining texture has the same cache key, so its init binds the storage already
    // filled before the leaving texture's dispose can free it, and the rows carry on.
    this.initWithoutData(next.texture);
    entry.texture = next.texture;
  }
}
