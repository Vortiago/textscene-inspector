/**
 * The tiled GPU upload for a large typed-array texture. three uploads a texture
 * whole, in one call, the first time it draws: a 4096² RGBA texture is 64 MiB,
 * which blocked the main thread for 34–435 ms in headless Chromium. This queue
 * allocates the texture's storage empty, then fills it in row bands, a few per
 * frame, so no frame carries the whole upload (ADR-0042).
 */

import * as THREE from 'three';
import { GpuResidency, residencyKey } from './gpuResidency';

/** The part of `THREE.WebGLRenderer` the queue uses, so a test can stand in for one. */
export interface UploadRenderer {
  initTexture(texture: THREE.Texture): void;
  copyTextureToTexture(
    source: THREE.Texture,
    destination: THREE.Texture,
    sourceRegion: THREE.Box2,
    destinationPosition: THREE.Vector2
  ): void;
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

const RGBA_BYTES = 4;

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
  texture: THREE.Texture;
  /** A texture over the same pixels that three never uploads, so each copy reads the CPU bytes. */
  source: THREE.DataTexture;
  /** three's cache key for `texture`, taken before the mipmap flag is cleared for the bands. */
  key: string;
  nextRow: number;
  wantsMipmaps: boolean;
  /** Every consumer of this GPU texture: the one that started it, and matching clones that joined. */
  waiters: Waiter[];
}

export class TiledUploadQueue {
  /** Written by `enqueue`, `tick` and a cancel. The head is the upload in progress. */
  private readonly queue: QueuedUpload[] = [];
  private readonly residency = new GpuResidency();

  constructor(
    private readonly renderer: UploadRenderer,
    private readonly now: () => number = () => performance.now()
  ) {}

  /** Whether three's own whole upload would carry more than one band. */
  needsTiling(texture: THREE.Texture): boolean {
    const image = texture.image as { data?: unknown; width?: number; height?: number } | null;
    if (!image || !ArrayBuffer.isView(image.data)) return false;
    const { width = 0, height = 0 } = image;
    return height > bandRows(width);
  }

  /**
   * Gets `texture` onto the GPU in bands. A clone that matches a GPU texture three
   * already has, or one already uploading, shares it instead of starting another.
   */
  enqueue(texture: THREE.Texture): TiledUpload {
    if (this.residency.isResident(texture)) {
      this.residency.hold(texture);
      return { done: Promise.resolve(true), cancel: () => {} };
    }
    const key = residencyKey(texture);
    const inFlight = this.queue.find((entry) => entry.texture.source === texture.source && entry.key === key);
    return this.join(inFlight ?? this.start(texture, key), texture);
  }

  /**
   * Allocates `texture` empty now, and queues its rows. The allocation clears
   * `dataReady` for one synchronous call only: the source is shared with every clone
   * of the texture, and nothing else can upload in between.
   */
  private start(texture: THREE.Texture, key: string): QueuedUpload {
    const { data, width, height } = texture.image as { data: Uint8Array; width: number; height: number };
    const entry: QueuedUpload = {
      texture,
      source: new THREE.DataTexture(data, width, height, texture.format as THREE.PixelFormat, texture.type),
      key,
      nextRow: 0,
      wantsMipmaps: texture.generateMipmaps,
      waiters: [],
    };
    this.allocate(entry, texture);
    this.queue.push(entry);
    return entry;
  }

  /** Points `entry` at `texture`'s GPU storage, allocated empty, and restarts it at row 0. */
  private allocate(entry: QueuedUpload, texture: THREE.Texture): void {
    texture.source.dataReady = false;
    try {
      this.renderer.initTexture(texture);
    } finally {
      texture.source.dataReady = true;
    }
    entry.texture = texture;
    entry.nextRow = 0;
    entry.wantsMipmaps = texture.generateMipmaps;
    // three generates mipmaps after every copy, so they wait for the last band.
    texture.generateMipmaps = false;
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

  /** Copies bands until `budgetMs` is spent, and always at least one. */
  tick(budgetMs: number): void {
    const startedAt = this.now();
    do {
      const entry = this.queue[0];
      if (!entry) return;
      this.copyBand(entry);
    } while (this.now() - startedAt < budgetMs);
  }

  private copyBand(entry: QueuedUpload): void {
    const { width, height } = entry.source.image;
    const fromRow = entry.nextRow;
    const toRow = Math.min(height, fromRow + bandRows(width));
    const isLast = toRow === height;
    if (isLast) entry.texture.generateMipmaps = entry.wantsMipmaps;
    this.renderer.copyTextureToTexture(
      entry.source,
      entry.texture,
      new THREE.Box2(new THREE.Vector2(0, fromRow), new THREE.Vector2(width, toRow)),
      new THREE.Vector2(0, fromRow)
    );
    entry.nextRow = toRow;
    if (isLast) this.complete(entry);
  }

  private complete(entry: QueuedUpload): void {
    this.queue.splice(this.queue.indexOf(entry), 1);
    for (const { texture, finish } of entry.waiters) {
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
    const [next] = entry.waiters;
    if (next && waiter.texture !== entry.texture) return;
    entry.texture.generateMipmaps = entry.wantsMipmaps;
    if (!next) {
      this.queue.splice(this.queue.indexOf(entry), 1);
      return;
    }
    // The texture it filled is about to be disposed, which frees that GPU storage, so
    // the rows start again in storage a remaining consumer's texture owns.
    this.allocate(entry, next.texture);
  }
}
