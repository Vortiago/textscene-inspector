import { useEffect, useReducer, useRef, useState } from 'react';
import * as THREE from 'three';
import { useTextureWorkWhile } from '../../resources/textures/textureWork';
import { imageSize } from '../../resources/formats/image/imagePixels';
import { paddedAtlasLayout, type AtlasPixels } from '../../resources/tileset/paddedAtlas';
import type { AtlasSourceModel } from '../../resources/tileset/types';
import type { Texture2DResult } from '../../resources/useTexture2D';
import { usePendingWhile } from '../../resources/usePendingWhile';
import { useResourceLoader } from '../../resources/useResource';
import { vector2Equals } from '../../godot/math/vector';
import { perObject } from '../../utils/perObject';
import { isBottomUp, reversedRows } from '../../utils/reversedRows';
import { inThreadJobRunner, type WorkerJobRunner } from '../../workers/WorkerJobRunner';
import { usePaddedAtlasStandIn } from '../paddedAtlasStandIn';
import { readGodotImage } from '../textureAtlas/godotImage';

type JobRunner = Pick<WorkerJobRunner, 'run'>;

/** What a padded run samples: the atlas, nothing while its copy builds, or nothing it can read. */
export type RuntimeAtlas = THREE.Texture | 'building' | 'unreadable';

/** A texture whose pixels this previewer cannot read: the run draws Godot's default shader instead. */
const UNREADABLE = 'unreadable';

/** One padded copy of one version of a texture, and the runs that hold it. */
interface PaddedCopy {
  readonly texture: THREE.Texture;
  readonly source: AtlasSourceModel;
  holders: number;
  readonly version: number;
  built: THREE.Texture | typeof UNREADABLE | undefined;
  readonly settled: Promise<THREE.Texture | typeof UNREADABLE>;
  readonly controller: AbortController;
}

/** Written only by `joinPaddedCopy`: the newest padded copy per source, dropped with its last holder. */
const paddedCopiesOf = perObject((_texture: THREE.Texture) => new Map<AtlasSourceModel, PaddedCopy>());

/** The slot's texture, its padded copy (`tile_set.cpp:5622`) or a stand-in. */
export function useRuntimeAtlasTexture(
  slot: Pick<Texture2DResult, 'texture' | 'hasNoImage'>,
  source: AtlasSourceModel
): RuntimeAtlas {
  const standIn = usePaddedAtlasStandIn(slot, source);
  const pads = source.usesTexturePadding;
  const copied = usePaddedCopy(pads && !standIn ? slot.texture : null, source);
  if (!pads) return slot.texture ?? 'building';
  return standIn ?? copied;
}

/** The padded copy every run of `source` shares, built as a worker job, the last one shown until it lands. */
function usePaddedCopy(texture: THREE.Texture | null, source: AtlasSourceModel): RuntimeAtlas {
  const runner = useResourceLoader()?.jobRunner ?? inThreadJobRunner;
  const [, landed] = useReducer((count: number) => count + 1, 0);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  if (failure) throw failure.error;
  // A new version is a new image, which an unreadable one may have become readable as.
  const version = texture?.version;
  useEffect(() => {
    if (!texture) return undefined;
    let current = true;
    const copy = joinPaddedCopy(texture, source, runner);
    copy.settled.then(
      () => current && landed(),
      (error: unknown) => current && setFailure({ error })
    );
    return () => {
      current = false;
      releasePaddedCopy(copy);
    };
  }, [texture, version, source, runner]);
  const wanted = texture ? paddedCopiesOf(texture).get(source) : undefined;
  const isBuilt = wanted?.version === version && wanted?.built !== undefined;
  /** Written after each commit: the copy the run showed, held until the next one shows. */
  const lastShown = useRef<PaddedCopy | undefined>(undefined);
  const held = lastShown.current;
  const shown = isBuilt
    ? wanted
    : texture && held && placesCellsAlike(held, texture, source)
      ? held
      : undefined;
  useEffect(() => {
    lastShown.current = shown;
  });
  useHeldCopy(shown);
  const isBuilding = texture !== null && !isBuilt;
  usePendingWhile(isBuilding);
  useTextureWorkWhile(isBuilding);
  return shown?.built ?? 'building';
}

/** Holds the shown copy until a later commit shows another, so its texture is never disposed in view. */
/** A copy of the same texture whose cells sit where the new source's do, so the draw samples them. */
function placesCellsAlike(copy: PaddedCopy, texture: THREE.Texture, source: AtlasSourceModel): boolean {
  const { margins, separation, textureRegionSize } = copy.source;
  return (
    copy.texture === texture &&
    vector2Equals(margins, source.margins) &&
    vector2Equals(separation, source.separation) &&
    vector2Equals(textureRegionSize, source.textureRegionSize)
  );
}

function useHeldCopy(copy: PaddedCopy | undefined): void {
  useEffect(() => {
    if (!copy) return undefined;
    copy.holders += 1;
    return () => releasePaddedCopy(copy);
  }, [copy]);
}

function joinPaddedCopy(texture: THREE.Texture, source: AtlasSourceModel, runner: JobRunner): PaddedCopy {
  const copies = paddedCopiesOf(texture);
  const held = copies.get(source);
  if (held?.version === texture.version) {
    held.holders += 1;
    return held;
  }
  const controller = new AbortController();
  const settled = buildPaddedCopy(texture, source, runner, controller.signal);
  const copy: PaddedCopy = {
    texture,
    source,
    holders: 1,
    version: texture.version,
    built: undefined,
    settled,
    controller,
  };
  // Registered before any holder's, so a holder that hears the build land reads `built`.
  settled.then(
    (built) => keepBuiltCopy(copy, built),
    () => dropPaddedCopy(copy)
  );
  copies.set(source, copy);
  return copy;
}

/** A build that lands after its last holder let go has no holder left to dispose it. */
function keepBuiltCopy(copy: PaddedCopy, built: THREE.Texture | typeof UNREADABLE): void {
  if (copy.holders > 0) copy.built = built;
  else disposeBuilt(built);
}

/** A released copy's abort lands after a new holder may have built the source's next copy. */
function dropPaddedCopy(copy: PaddedCopy): void {
  const copies = paddedCopiesOf(copy.texture);
  if (copies.get(copy.source) === copy) copies.delete(copy.source);
}

/** A microtask, not now: StrictMode and a re-render release and take a copy again in one task. */
function releasePaddedCopy(copy: PaddedCopy): void {
  copy.holders -= 1;
  queueMicrotask(() => {
    if (copy.holders > 0) return;
    dropPaddedCopy(copy);
    copy.controller.abort();
    disposeBuilt(copy.built);
    // A run releases a copy it both wants and shows twice, so the second release finds nothing to dispose.
    copy.built = undefined;
  });
}

function disposeBuilt(built: PaddedCopy['built']): void {
  if (built instanceof THREE.Texture) built.dispose();
}

/** Reads the pixels after the commit that asked: no React render waits on the readback. */
async function buildPaddedCopy(
  texture: THREE.Texture,
  source: AtlasSourceModel,
  runner: JobRunner,
  signal: AbortSignal
): Promise<THREE.Texture | typeof UNREADABLE> {
  await Promise.resolve();
  const release = holdPixels(texture);
  try {
    const pixels = pixelsOf(texture);
    if (!pixels) return UNREADABLE;
    const padded = await runner.run('padded-atlas', { pixels, layout: paddedAtlasLayout(source) }, signal);
    return paddedTexture(padded, texture);
  } finally {
    release();
  }
}

function paddedTexture(padded: AtlasPixels, texture: THREE.Texture): THREE.DataTexture {
  const atlas = new THREE.DataTexture(padded.data, padded.width, padded.height);
  atlas.type = padded.data instanceof Uint16Array ? THREE.HalfFloatType : THREE.UnsignedByteType;
  // Top row first, as Godot's image: `flipY` marks it so, and the shader samples it with no copy.
  atlas.flipY = true;
  atlas.colorSpace = texture.colorSpace;
  atlas.needsUpdate = true;
  return atlas;
}

/** A half-float texture's bits, top row first: Godot pads in the image's own format (`tile_set.cpp:5637`). */
function halfFloatImage(texture: THREE.Texture): AtlasPixels | undefined {
  const { data } = (texture.image ?? {}) as { data?: unknown };
  const size = imageSize(texture.image);
  if (texture.type !== THREE.HalfFloatType || !(data instanceof Uint16Array) || !size) return undefined;
  return { ...size, data: isBottomUp(texture) ? reversedRows(data, size.width, size.height) : data };
}

interface PixelsInFlight {
  builds: number;
  version: number;
  pixels: AtlasPixels | null | undefined;
}

/** Written only by `holdPixels` and `pixelsOf`: a texture's read while a build of it runs, dropped after. */
const pixelsInFlight = perObject((_texture: THREE.Texture): PixelsInFlight => ({
  builds: 0,
  version: -1,
  pixels: undefined,
}));

/** Keeps the read for the builds in flight, so two sources of a texture read it once and none keeps it. */
function holdPixels(texture: THREE.Texture): () => void {
  const read = pixelsInFlight(texture);
  read.builds += 1;
  return () => {
    read.builds -= 1;
    if (read.builds === 0) read.pixels = undefined;
  };
}

/** Null for pixels it cannot read. */
function pixelsOf(texture: THREE.Texture): AtlasPixels | null {
  const read = pixelsInFlight(texture);
  if (read.pixels === undefined || read.version !== texture.version) {
    read.pixels = halfFloatImage(texture) ?? readGodotImage(texture) ?? null;
    read.version = texture.version;
  }
  return read.pixels;
}
