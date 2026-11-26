import { useEffect, useReducer, useRef, useState } from 'react';
import * as THREE from 'three';
import { useTextureWorkWhile } from '../../resources/textures/textureWork';
import { paddedAtlasLayout, paddedAtlasSize, type AtlasPixels } from '../../resources/tileset/paddedAtlas';
import { imageSize } from '../../resources/formats/image/imagePixels';
import type { AtlasSourceModel } from '../../resources/tileset/types';
import type { Texture2DResult } from '../../resources/useTexture2D';
import { usePendingWhile } from '../../resources/usePendingWhile';
import { useResourceLoader } from '../../resources/useResource';
import { vector2Equals } from '../../godot/math/vector';
import { perObject } from '../../utils/perObject';
import { inThreadJobRunner, type WorkerJobRunner } from '../../workers/WorkerJobRunner';
import { usePaddedAtlasStandIn } from '../paddedAtlasStandIn';
import { holdUntilReleased, isHeld, useDisposeOnRelease } from '../useDisposeOnRelease';
import { holdOwnFormatImage } from '../textureAtlas/godotImage';

type JobRunner = Pick<WorkerJobRunner, 'run'>;

/** What a padded run samples: the atlas, nothing while its copy builds, or nothing it can read. */
export type RuntimeAtlas = THREE.Texture | 'building' | 'unreadable';

/** A texture whose pixels this previewer cannot read: the run samples it at its unpadded regions. */
const UNREADABLE = 'unreadable';

/** One padded copy of one version of a texture, which its last holder's release disposes. */
interface PaddedCopy {
  readonly texture: THREE.Texture;
  readonly source: AtlasSourceModel;
  readonly version: number;
  built: THREE.Texture | typeof UNREADABLE | undefined;
  readonly settled: Promise<THREE.Texture | typeof UNREADABLE>;
  dispose(): void;
}

/** A build that failed, which the run throws while it still asks for that version of that source. */
interface Failure {
  readonly error: unknown;
  readonly texture: THREE.Texture;
  readonly version: number;
  readonly source: AtlasSourceModel;
}

/** Written only by `joinPaddedCopy` and `dropPaddedCopy`: the newest copy per source, dropped on dispose. */
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
  const [failure, setFailure] = useState<Failure | null>(null);
  // A runner's release aborts the jobs it holds, so a run that still asks joins a new build.
  const [rejoins, rejoin] = useReducer((count: number) => count + 1, 0);
  // A new version is a new image, which an unreadable one may have become readable as.
  const version = texture?.version;
  if (failure && isFailureOf(failure, texture, source)) throw failure.error;
  useEffect(() => {
    if (!texture) return undefined;
    let current = true;
    const { copy, release } = joinPaddedCopy(texture, source, runner);
    copy.settled.then(
      () => current && landed(),
      (error: unknown) => {
        if (!current) return;
        if (isAbort(error)) rejoin();
        else setFailure({ error, texture, version: copy.version, source });
      }
    );
    return () => {
      current = false;
      release();
    };
  }, [texture, version, source, runner, rejoins]);
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
  // Held until a later commit shows another copy, so its texture is never disposed in view.
  useDisposeOnRelease(shown);
  const isBuilding = texture !== null && !isBuilt;
  usePendingWhile(isBuilding);
  useTextureWorkWhile(isBuilding);
  return shown?.built ?? 'building';
}

/** A copy of the same texture whose cells sit where the new source's do, so the draw samples them. */
function placesCellsAlike(copy: PaddedCopy, texture: THREE.Texture, source: AtlasSourceModel): boolean {
  const { margins, separation, textureRegionSize } = copy.source;
  return (
    copy.texture === texture &&
    vector2Equals(margins, source.margins) &&
    vector2Equals(separation, source.separation) &&
    vector2Equals(textureRegionSize, source.textureRegionSize) &&
    hasPaddedSizeOf(copy.built, texture, source)
  );
}

/** Whether `built` has the padded size of `texture`'s image, so the cells' UVs count the same atlas. */
function hasPaddedSizeOf(
  built: PaddedCopy['built'],
  texture: THREE.Texture,
  source: AtlasSourceModel
): boolean {
  // The unreadable draw samples the texture itself, at its own size.
  if (!(built instanceof THREE.Texture)) return true;
  const padded = paddedAtlasSize(source, imageSize(texture.image) ?? { width: 0, height: 0 });
  const size = imageSize(built.image);
  return size?.width === padded.width && size?.height === padded.height;
}

function isFailureOf(failure: Failure, texture: THREE.Texture | null, source: AtlasSourceModel): boolean {
  return failure.texture === texture && failure.version === texture.version && failure.source === source;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** The source's copy of this version of `texture`, held until `release` runs. */
function joinPaddedCopy(
  texture: THREE.Texture,
  source: AtlasSourceModel,
  runner: JobRunner
): { copy: PaddedCopy; release: () => void } {
  const copies = paddedCopiesOf(texture);
  const held = copies.get(source);
  if (held?.version === texture.version) return { copy: held, release: holdUntilReleased(held) };
  const controller = new AbortController();
  const settled = buildPaddedCopy(texture, source, runner, controller.signal);
  const copy: PaddedCopy = {
    texture,
    source,
    version: texture.version,
    built: undefined,
    settled,
    dispose: () => {
      dropPaddedCopy(copy);
      controller.abort();
      disposeBuilt(copy.built);
    },
  };
  // Registered before any holder's, so a holder that hears the build land reads `built`.
  settled.then(
    (built) => keepBuiltCopy(copy, built),
    () => dropPaddedCopy(copy)
  );
  copies.set(source, copy);
  return { copy, release: holdUntilReleased(copy) };
}

/** A build that lands after its last holder let go has no holder left to dispose it. */
function keepBuiltCopy(copy: PaddedCopy, built: THREE.Texture | typeof UNREADABLE): void {
  if (isHeld(copy)) copy.built = built;
  else disposeBuilt(built);
}

/** A released copy's abort lands after a new holder may have built the source's next copy. */
function dropPaddedCopy(copy: PaddedCopy): void {
  const copies = paddedCopiesOf(copy.texture);
  if (copies.get(copy.source) === copy) copies.delete(copy.source);
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
  // A task, not a microtask: a copy released in the commit's task aborts first and reads nothing.
  await new Promise((resume) => setTimeout(resume));
  if (signal.aborted) throw signal.reason;
  const { image, release } = holdOwnFormatImage(texture);
  try {
    if (!image) return UNREADABLE;
    const padded = await runner.run(
      'padded-atlas',
      { pixels: image, layout: paddedAtlasLayout(source) },
      signal
    );
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
