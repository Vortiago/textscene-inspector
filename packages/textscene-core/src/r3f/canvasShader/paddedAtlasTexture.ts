import { useEffect, useReducer, useState } from 'react';
import * as THREE from 'three';
import { textureWork } from '../../resources/textures/textureWork';
import { paddedAtlasLayout } from '../../resources/tileset/paddedAtlas';
import type { AtlasSourceModel } from '../../resources/tileset/types';
import type { Texture2DResult } from '../../resources/useTexture2D';
import { usePendingWhile } from '../../resources/usePendingWhile';
import { useResourceLoader } from '../../resources/useResource';
import { perObject } from '../../utils/perObject';
import { inThreadJobRunner, type WorkerJobRunner } from '../../workers/WorkerJobRunner';
import { usePaddedAtlasStandIn } from '../paddedAtlasStandIn';
import { godotImage } from '../textureAtlas/godotImage';

type JobRunner = Pick<WorkerJobRunner, 'run'>;

/** What a padded run samples: the atlas, nothing while its copy builds, or nothing it can read. */
export type RuntimeAtlas = THREE.Texture | 'building' | 'unreadable';

/** A texture whose pixels this previewer cannot read: the run draws Godot's default shader instead. */
const UNREADABLE = 'unreadable';

/** One padded copy of one version of a texture, and the runs that hold it. */
interface PaddedCopy {
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

/** The padded copy of `texture` that every run of `source` shares, built off the render as a worker job. */
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
      releasePaddedCopy(texture, source, copy);
    };
  }, [texture, version, source, runner]);
  const copy = texture ? paddedCopiesOf(texture).get(source) : undefined;
  const built = copy?.version === version ? copy?.built : undefined;
  usePendingWhile(texture !== null && built === undefined);
  return built ?? 'building';
}

function joinPaddedCopy(texture: THREE.Texture, source: AtlasSourceModel, runner: JobRunner): PaddedCopy {
  const copies = paddedCopiesOf(texture);
  const held = copies.get(source);
  if (held?.version === texture.version) {
    held.holders += 1;
    return held;
  }
  const controller = new AbortController();
  const endWork = textureWork.begin();
  const settled = buildPaddedCopy(texture, source, runner, controller.signal);
  const copy: PaddedCopy = { holders: 1, version: texture.version, built: undefined, settled, controller };
  // Registered before any holder's, so a holder that hears the build land reads `built`.
  settled
    .then(
      (built) => keepBuiltCopy(copy, built),
      () => dropPaddedCopy(copies, source, copy)
    )
    .finally(endWork);
  copies.set(source, copy);
  return copy;
}

/** A build that lands after its last holder let go has no holder left to dispose it. */
function keepBuiltCopy(copy: PaddedCopy, built: THREE.Texture | typeof UNREADABLE): void {
  if (copy.holders > 0) copy.built = built;
  else disposeBuilt(built);
}

/** A released copy's abort lands after a new holder may have built the source's next copy. */
function dropPaddedCopy(
  copies: Map<AtlasSourceModel, PaddedCopy>,
  source: AtlasSourceModel,
  copy: PaddedCopy
): void {
  if (copies.get(source) === copy) copies.delete(source);
}

/** A microtask, not now: StrictMode and a re-render release and take a copy again in one task. */
function releasePaddedCopy(texture: THREE.Texture, source: AtlasSourceModel, copy: PaddedCopy): void {
  copy.holders -= 1;
  queueMicrotask(() => {
    if (copy.holders > 0) return;
    dropPaddedCopy(paddedCopiesOf(texture), source, copy);
    copy.controller.abort();
    disposeBuilt(copy.built);
  });
}

function disposeBuilt(built: PaddedCopy['built']): void {
  if (built instanceof THREE.Texture) built.dispose();
}

/** Reads the pixels once per texture, after the commit that asked: no React render waits on the readback. */
async function buildPaddedCopy(
  texture: THREE.Texture,
  source: AtlasSourceModel,
  runner: JobRunner,
  signal: AbortSignal
): Promise<THREE.Texture | typeof UNREADABLE> {
  await Promise.resolve();
  const pixels = godotImage(texture);
  if (!pixels) return UNREADABLE;
  const input = { pixels, layout: paddedAtlasLayout(source) };
  const padded = await runner.run('padded-atlas', input, signal);
  const atlas = new THREE.DataTexture(padded.data, padded.width, padded.height);
  // Top row first, as Godot's image: `flipY` marks it so, and the shader samples it with no copy.
  atlas.flipY = true;
  atlas.colorSpace = texture.colorSpace;
  atlas.needsUpdate = true;
  return atlas;
}
