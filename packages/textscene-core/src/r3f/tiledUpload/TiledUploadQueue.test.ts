/**
 * The tiled GPU upload: a large typed-array texture is allocated empty, then
 * filled in row bands across frames, within a time budget per frame, so no
 * single frame carries the whole upload.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bandRows, TiledUploadQueue, type UploadRenderer } from './TiledUploadQueue';

interface Copy {
  source: THREE.Texture;
  destination: THREE.Texture;
  fromRow: number;
  toRow: number;
  atRow: number;
  mipmapsOn: boolean;
}

/** A renderer that records calls, and a clock that each copy advances by `msPerCopy`. */
function fakeRenderer(msPerCopy = 1) {
  let clock = 0;
  const copies: Copy[] = [];
  const allocations: { texture: THREE.Texture; dataReady: boolean }[] = [];
  const renderer: UploadRenderer = {
    initTexture: (texture) => {
      allocations.push({ texture, dataReady: texture.source.dataReady });
    },
    copyTextureToTexture: (source, destination, region, position) => {
      const box = region as THREE.Box2;
      copies.push({
        source,
        destination,
        fromRow: box.min.y,
        toRow: box.max.y,
        atRow: (position as THREE.Vector2).y,
        mipmapsOn: destination.generateMipmaps,
      });
      clock += msPerCopy;
    },
  };
  return { renderer, copies, allocations, now: () => clock };
}

function dataTexture(width: number, height: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array(width * height * 4), width, height);
  texture.needsUpdate = true;
  return texture;
}

describe('bandRows', () => {
  it('gives a 4096-wide texture 128 rows, about 2 MiB a band', () => {
    expect(bandRows(4096)).toBe(128);
  });

  it('gives at least one row to a texture wider than a band', () => {
    expect(bandRows(1 << 20)).toBe(1);
  });
});

describe('TiledUploadQueue', () => {
  it('allocates the texture empty, and restores its data flag at once', () => {
    const { renderer, allocations, now } = fakeRenderer();
    const texture = dataTexture(4096, 512);
    new TiledUploadQueue(renderer, now).enqueue(texture);

    expect(allocations).toEqual([{ texture, dataReady: false }]);
    expect(texture.source.dataReady).toBe(true);
  });

  it('copies every row exactly once, in order, into the same rows', async () => {
    const { renderer, copies, now } = fakeRenderer();
    const texture = dataTexture(4096, 300);
    const queue = new TiledUploadQueue(renderer, now);
    const upload = queue.enqueue(texture);
    queue.tick(1000);
    await upload.done;

    expect(copies.map(({ fromRow, toRow, atRow }) => [fromRow, toRow, atRow])).toEqual([
      [0, 128, 0],
      [128, 256, 128],
      [256, 300, 256],
    ]);
    expect(copies.every(({ destination }) => destination === texture)).toBe(true);
    // The source shares the pixels but is never uploaded itself.
    expect((copies[0]?.source.image as { data: Uint8Array } | undefined)?.data).toBe(texture.image.data);
    expect(copies[0]?.source).not.toBe(texture);
  });

  it('stops a frame once its budget is spent, and carries on next frame', () => {
    const { renderer, copies, now } = fakeRenderer(3);
    const queue = new TiledUploadQueue(renderer, now);
    queue.enqueue(dataTexture(4096, 128 * 5));
    queue.tick(5);
    expect(copies).toHaveLength(2);
    queue.tick(5);
    expect(copies).toHaveLength(4);
  });

  it('uploads at least one band a frame, however small the budget', () => {
    const { renderer, copies, now } = fakeRenderer(10);
    const queue = new TiledUploadQueue(renderer, now);
    queue.enqueue(dataTexture(4096, 128 * 3));
    queue.tick(0);
    expect(copies).toHaveLength(1);
  });

  it('generates mipmaps once, on the last band, for a texture that wants them', async () => {
    const { renderer, copies, now } = fakeRenderer();
    const texture = dataTexture(4096, 300);
    texture.generateMipmaps = true;
    const queue = new TiledUploadQueue(renderer, now);
    const upload = queue.enqueue(texture);
    queue.tick(1000);
    await upload.done;

    expect(copies.map(({ mipmapsOn }) => mipmapsOn)).toEqual([false, false, true]);
    expect(texture.generateMipmaps).toBe(true);
  });

  it('makes no further copies after a cancel, and settles as not uploaded', async () => {
    const { renderer, copies, now } = fakeRenderer(3);
    const texture = dataTexture(4096, 128 * 4);
    texture.generateMipmaps = true;
    const queue = new TiledUploadQueue(renderer, now);
    const upload = queue.enqueue(texture);
    queue.tick(1);
    upload.cancel();
    queue.tick(1000);

    expect(copies).toHaveLength(1);
    expect(await upload.done).toBe(false);
    expect(texture.generateMipmaps).toBe(true);
  });

  it('serves two textures in the order they arrived', async () => {
    const { renderer, copies, now } = fakeRenderer();
    const first = dataTexture(4096, 256);
    const second = dataTexture(4096, 256);
    const queue = new TiledUploadQueue(renderer, now);
    queue.enqueue(first);
    queue.enqueue(second);
    queue.tick(1000);

    expect(copies.map(({ destination }) => destination)).toEqual([first, first, second, second]);
  });
});

describe('TiledUploadQueue with textures three already shares', () => {
  it('copies no row for a clone of a texture it finished uploading', async () => {
    const { renderer, copies, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now);
    const texture = dataTexture(4096, 300);
    const first = queue.enqueue(texture);
    queue.tick(1000);
    await first.done;
    const copiesBefore = copies.length;

    const again = queue.enqueue(texture.clone());
    expect(await again.done).toBe(true);
    expect(copies.length).toBe(copiesBefore);
  });

  it('binds a late clone to the resident storage with its data flag cleared', async () => {
    // The clone bumped the source version, so a draw would otherwise upload it whole.
    const { renderer, allocations, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now);
    const texture = dataTexture(4096, 300);
    const first = queue.enqueue(texture);
    queue.tick(1000);
    await first.done;

    const clone = texture.clone();
    queue.enqueue(clone);
    expect(allocations.at(-1)).toEqual({ texture: clone, dataReady: false });
    expect(clone.source.dataReady).toBe(true);
  });

  it('runs one upload for two matching clones that arrive while it is in flight', async () => {
    const { renderer, copies, allocations, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now);
    const texture = dataTexture(4096, 300);
    const clone = texture.clone();
    const first = queue.enqueue(texture);
    const second = queue.enqueue(clone);
    queue.tick(1000);

    expect(await first.done).toBe(true);
    expect(await second.done).toBe(true);
    expect(copies).toHaveLength(3);
    expect(copies.every(({ destination }) => destination === texture)).toBe(true);
    // The clone joins the filled storage once the rows are in, without a copy of its own.
    expect(allocations).toEqual([
      { texture, dataReady: false },
      { texture: clone, dataReady: false },
    ]);
  });

  it('joins the upload a texture is already in, although its mipmap flag is cleared meanwhile', async () => {
    const { renderer, copies, allocations, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now);
    const texture = dataTexture(4096, 300);
    texture.generateMipmaps = true;
    const first = queue.enqueue(texture);
    const second = queue.enqueue(texture);
    queue.tick(1000);

    expect(await first.done).toBe(true);
    expect(await second.done).toBe(true);
    expect(allocations).toHaveLength(1);
    expect(copies).toHaveLength(3);
    expect(texture.generateMipmaps).toBe(true);
  });

  it('keeps its rows when one of two consumers of the same texture leaves', async () => {
    const { renderer, copies, allocations, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now);
    const texture = dataTexture(4096, 300);
    const first = queue.enqueue(texture);
    const second = queue.enqueue(texture);
    queue.tick(0);
    first.cancel();
    queue.tick(1000);

    expect(await second.done).toBe(true);
    expect(allocations).toHaveLength(1);
    expect(copies.map(({ fromRow, toRow }) => [fromRow, toRow])).toEqual([
      [0, 128],
      [128, 256],
      [256, 300],
    ]);
  });

  it('keeps a shared upload going while one of its holders remains', async () => {
    const { renderer, copies, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now);
    const texture = dataTexture(4096, 300);
    const first = queue.enqueue(texture);
    const second = queue.enqueue(texture.clone());
    first.cancel();
    queue.tick(1000);

    expect(await first.done).toBe(false);
    expect(await second.done).toBe(true);
    expect(copies).toHaveLength(3);
  });

  it('moves a shared upload onto a remaining texture when the one it started on leaves', async () => {
    // The remaining clone has the same cache key, so its init binds the storage the rows
    // already fill, and three keeps that storage while any texture bound to it lives.
    const { renderer, copies, allocations, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now);
    const texture = dataTexture(4096, 300);
    const clone = texture.clone();
    const first = queue.enqueue(texture);
    const second = queue.enqueue(clone);
    queue.tick(0);
    first.cancel();
    queue.tick(1000);

    expect(await second.done).toBe(true);
    expect(allocations.map((allocation) => allocation.texture)).toEqual([texture, clone]);
    expect(copies.map(({ destination, fromRow, toRow }) => [destination, fromRow, toRow])).toEqual([
      [texture, 0, 128],
      [clone, 128, 256],
      [clone, 256, 300],
    ]);
  });

  it('uploads again once every texture that shared the upload is disposed', async () => {
    const { renderer, allocations, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now);
    const texture = dataTexture(4096, 300);
    const first = queue.enqueue(texture);
    queue.tick(1000);
    await first.done;
    texture.dispose();

    queue.enqueue(texture.clone());
    expect(allocations).toHaveLength(2);
  });
});

describe('TiledUploadQueue.needsTiling', () => {
  const { renderer, now } = fakeRenderer();
  const queue = new TiledUploadQueue(renderer, now);

  it('tiles a typed-array texture taller than one band', () => {
    expect(queue.needsTiling(dataTexture(4096, 129))).toBe(true);
  });

  it('leaves a texture of one band or less to three', () => {
    expect(queue.needsTiling(dataTexture(4096, 128))).toBe(false);
  });

  it('leaves an image-backed texture to three', () => {
    const texture = new THREE.Texture({ width: 4096, height: 4096 } as unknown as HTMLImageElement);
    expect(queue.needsTiling(texture)).toBe(false);
  });
});
