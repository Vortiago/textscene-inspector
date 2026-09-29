/**
 * The tiled GPU upload for a large typed-array texture. three uploads a texture
 * whole, in one call, the first time it draws: a 4096² RGBA texture is 64 MiB,
 * which blocked the main thread for 34–435 ms in headless Chromium. This queue
 * allocates the texture's storage empty, then fills it in row bands, a few per
 * frame, so no frame carries the whole upload (ADR-0042).
 */

import * as THREE from 'three';

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

/** A texture's place in the queue. */
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

interface QueuedUpload {
  texture: THREE.Texture;
  /** A texture over the same pixels that three never uploads, so each copy reads the CPU bytes. */
  source: THREE.DataTexture;
  nextRow: number;
  wantsMipmaps: boolean;
  finish: (uploaded: boolean) => void;
}

export class TiledUploadQueue {
  /** Written by `enqueue`, `tick` and a cancel. The head is the upload in progress. */
  private readonly queue: QueuedUpload[] = [];

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
   * Allocates `texture` empty now, and queues its rows. The allocation clears
   * `dataReady` for one synchronous call only: the source is shared with every clone
   * of the texture, and nothing else can upload in between.
   */
  enqueue(texture: THREE.Texture): TiledUpload {
    const { data, width, height } = texture.image as { data: Uint8Array; width: number; height: number };
    texture.source.dataReady = false;
    try {
      this.renderer.initTexture(texture);
    } finally {
      texture.source.dataReady = true;
    }

    let finish: (uploaded: boolean) => void = () => {};
    const done = new Promise<boolean>((resolve) => {
      finish = resolve;
    });
    const entry: QueuedUpload = {
      texture,
      source: new THREE.DataTexture(data, width, height, texture.format as THREE.PixelFormat, texture.type),
      nextRow: 0,
      wantsMipmaps: texture.generateMipmaps,
      finish,
    };
    // three generates mipmaps after every copy, so they wait for the last band.
    texture.generateMipmaps = false;
    this.queue.push(entry);
    return { done, cancel: () => this.cancel(entry) };
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
    if (isLast) this.settle(entry, true);
  }

  private cancel(entry: QueuedUpload): void {
    if (!this.queue.includes(entry)) return;
    entry.texture.generateMipmaps = entry.wantsMipmaps;
    this.settle(entry, false);
  }

  private settle(entry: QueuedUpload, uploaded: boolean): void {
    this.queue.splice(this.queue.indexOf(entry), 1);
    entry.finish(uploaded);
  }
}
