import { useEffect, useReducer, useState } from 'react';
import * as THREE from 'three';
import { texture2DPlaceholder } from '../../resources/textures/texture2DPlaceholder';
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

/** One padded copy and the runs that hold it. */
interface PaddedCopy {
  holders: number;
  /** Null once built from a texture with no readable pixels, which Godot pads as an empty image. */
  built: THREE.Texture | null | undefined;
  readonly settled: Promise<THREE.Texture | null>;
  readonly controller: AbortController;
}

/** Written only by `joinPaddedCopy`: each texture's padded copies by source, dropped with the last holder. */
const paddedCopiesOf = perObject((_texture: THREE.Texture) => new Map<AtlasSourceModel, PaddedCopy>());

/** The slot's texture, its padded copy (`tile_set.cpp:5622`) or a stand-in; null while the copy builds. */
export function useRuntimeAtlasTexture(
  slot: Pick<Texture2DResult, 'texture' | 'hasNoImage'>,
  source: AtlasSourceModel
): THREE.Texture | null {
  const standIn = usePaddedAtlasStandIn(slot, source);
  const pads = source.usesTexturePadding;
  const copied = usePaddedCopy(pads && !standIn ? slot.texture : null, source);
  if (!pads) return slot.texture;
  return standIn ?? copied;
}

/** The padded copy of `texture` that every run of `source` shares, built off the render as a worker job. */
function usePaddedCopy(texture: THREE.Texture | null, source: AtlasSourceModel): THREE.Texture | null {
  const runner = useResourceLoader()?.jobRunner ?? inThreadJobRunner;
  const [, landed] = useReducer((count: number) => count + 1, 0);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  if (failure) throw failure.error;
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
  }, [texture, source, runner]);
  const built = texture ? paddedCopiesOf(texture).get(source)?.built : undefined;
  usePendingWhile(texture !== null && built === undefined);
  if (built === undefined) return null;
  return built ?? texture2DPlaceholder();
}

function joinPaddedCopy(texture: THREE.Texture, source: AtlasSourceModel, runner: JobRunner): PaddedCopy {
  const copies = paddedCopiesOf(texture);
  const held = copies.get(source);
  if (held) {
    held.holders += 1;
    return held;
  }
  const controller = new AbortController();
  const endWork = textureWork.begin();
  const settled = buildPaddedCopy(texture, source, runner, controller.signal);
  const copy: PaddedCopy = { holders: 1, built: undefined, settled, controller };
  // Registered before any holder's, so a holder that hears the build land reads `built`.
  settled
    .then(
      (built) => keepBuiltCopy(copies, source, copy, built),
      () => dropPaddedCopy(copies, source, copy)
    )
    .finally(endWork);
  copies.set(source, copy);
  return copy;
}

/** A build that lands after its last holder let go is out of the map, so nothing else disposes it. */
function keepBuiltCopy(
  copies: Map<AtlasSourceModel, PaddedCopy>,
  source: AtlasSourceModel,
  copy: PaddedCopy,
  built: THREE.Texture | null
): void {
  if (copies.get(source) === copy) copy.built = built;
  else built?.dispose();
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
    const copies = paddedCopiesOf(texture);
    if (copy.holders > 0 || copies.get(source) !== copy) return;
    copies.delete(source);
    copy.controller.abort();
    copy.built?.dispose();
  });
}

/** Reads the pixels once per texture, after the commit that asked: no React render waits on the readback. */
async function buildPaddedCopy(
  texture: THREE.Texture,
  source: AtlasSourceModel,
  runner: JobRunner,
  signal: AbortSignal
): Promise<THREE.Texture | null> {
  await Promise.resolve();
  const pixels = godotImage(texture);
  if (!pixels) return null;
  const input = { pixels, layout: paddedAtlasLayout(source) };
  const padded = await runner.run('padded-atlas', input, signal);
  const atlas = new THREE.DataTexture(padded.data, padded.width, padded.height);
  // Top row first, as Godot's image: `flipY` marks it so, and the shader samples it with no copy.
  atlas.flipY = true;
  atlas.colorSpace = texture.colorSpace;
  atlas.needsUpdate = true;
  return atlas;
}
