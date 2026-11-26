import { isGodotTextResourcePath } from '../../godot/project/resourceFormats.js';
import { isGltfPath } from '../../godot/import/gltf.js';
import { importMaterialPaths } from '../formats/glb/glbProcessing.js';
import type { SceneFailure, SceneFile } from '../../scene/sceneFiles.js';
import { resourceFileReads, sceneFileReads, type FileRead } from '../loadFailure/fileReads.js';
import type { LoadOutcome } from '../loadFailure/loadOutcome.js';
import { sceneFailureOf, type SceneFailingReads } from '../loadFailure/sceneFailure.js';
import type { ParsedResource } from '../../parser/parsedResource.js';
import type { TscnScene } from '../../parser/types.js';
import type { ResourceLoader } from '../ResourceLoader.js';
import type { ResourceType } from '../ResourceEventBus.js';
import { fileExtension } from '../fileExtension.js';
import { parseSubResourcePath, resourceFilePath } from '../subResourcePath.js';

/** A null owner is the engine, which reads the project settings. */
export interface WalkStart {
  readonly owner: string | null;
  readonly reads: readonly FileRead[];
  /** True while the owner still reads the files, so each stays `loading` whatever its outcome. */
  readonly isReading?: boolean;
  /** True for reads the failure is judged on and no value makes: their files are not listed or followed. */
  readonly isJudgedOnly?: boolean;
}

/** What the walk reads from, one object so the starts and the failing reads cannot drift apart. */
export interface WalkInput {
  readonly starts: readonly WalkStart[];
  readonly failing: SceneFailingReads | null;
}

/** The files, and the failure through which the game refuses the scene. */
export interface WalkedFiles {
  readonly files: readonly SceneFile[];
  readonly failure: SceneFailure | null;
}

export interface SceneFileWalk {
  /** The same object while no file moves. The caller passes the same input while none moves. */
  files(input: WalkInput): WalkedFiles;
  dispose(): void;
}

/** What the walk keeps of a text file's parse once it loads: the parse itself the loader may release. */
interface TextFile {
  readonly reads: readonly FileRead[];
  readonly subResourceIds: ReadonlySet<string>;
}

interface Entry {
  type: string | null;
  isReading: boolean;
  isListed: boolean;
  readonly owners: string[];
  readonly addresses: string[];
}

const WATCHED: ResourceType[] = ['scene', 'resource', 'glb', 'loadoutcome'];

const NO_FILES: WalkedFiles = { files: [], failure: null };

/** `onChange` runs when a load answers for a file of the last walk. */
export function createSceneFileWalk(loader: ResourceLoader, onChange: () => void): SceneFileWalk {
  /** Written only by `textFile`, `releaseOutside` and the change listener. Null where a parse fails. */
  const textFiles = new Map<string, TextFile | null>();
  /** Written only by `textFile` and `releaseOutside`: held in the cache until the walk keeps the reads. */
  const pinnedParses = new Set<string>();
  /** Written only by `remapsOf`, `releaseOutside` and the change listener: a glTF's remapped materials. */
  const modelRemaps = new Map<string, readonly string[]>();
  /** Written only by `remapsOf` and `releaseOutside`: held in the cache until the walk keeps the remaps. */
  const pinnedModels = new Set<string>();
  /** Written only by `outcome` and `releaseOutside`: held in the loader's cache. */
  const pinnedOutcomes = new Set<string>();
  /** Written by `files` and cleared by the change listener: the input of the last walk. */
  let walkedInput: WalkInput | null = null;
  let walked: WalkedFiles = NO_FILES;
  let walkedPaths: ReadonlySet<string> = new Set();
  let walkedKey = '';

  const processorOf = (file: string) => (fileExtension(file) === '.tscn' ? loader.scenes : loader.resources);

  function textFile(file: string): TextFile | null | undefined {
    if (textFiles.has(file)) return textFiles.get(file);
    const processor = processorOf(file);
    const parsed = processor.getCached(file);
    if (parsed === undefined) {
      if (!pinnedParses.has(file)) {
        pinnedParses.add(file);
        processor.pin(file);
        processor.request(file);
      }
      return undefined;
    }
    if (pinnedParses.delete(file)) processor.unpin(file);
    const text = parsed && textFileOf(file, parsed);
    textFiles.set(file, text);
    return text;
  }

  /** The `.tres` files an import sidecar remaps the model's materials to, none until the model loads. */
  function remapsOf(file: string): readonly string[] {
    const known = modelRemaps.get(file);
    if (known) return known;
    const model = loader.glbMeshes.getCached(file);
    if (model === undefined) {
      if (!pinnedModels.has(file)) {
        pinnedModels.add(file);
        loader.glbMeshes.pin(file);
        loader.glbMeshes.request(file);
      }
      return [];
    }
    if (pinnedModels.delete(file)) loader.glbMeshes.unpin(file);
    const remaps = model ? importMaterialPaths(model) : [];
    modelRemaps.set(file, remaps);
    return remaps;
  }

  /** Godot drops a remapped material that fails to load (resource_importer_scene.cpp:1622-1636). */
  function isFailedLoad(file: string): boolean {
    return outcome(file)?.isFailed === true;
  }

  function outcome(file: string): LoadOutcome | null | undefined {
    const cached = loader.loadOutcomes.getCached(file);
    if (!pinnedOutcomes.has(file)) {
      pinnedOutcomes.add(file);
      loader.loadOutcomes.pin(file);
    }
    if (cached === undefined && !loader.loadOutcomes.isLoading(file)) loader.loadOutcomes.request(file);
    return cached;
  }

  function entriesFrom(starts: readonly WalkStart[]): Map<string, Entry> {
    const engineReads = new Set(
      starts.flatMap((start) => (start.owner === null ? start.reads.map((read) => read.path) : []))
    );
    // The scene is where the walk starts, not a file it loads.
    const roots = new Set(
      starts.flatMap(({ owner }) => (owner === null || engineReads.has(owner) ? [] : [owner]))
    );
    const entries = new Map<string, Entry>();
    const queue: string[] = [];
    const visit = (owner: string | null, { path, type }: FileRead, isReading = false, isListed = true) => {
      const file = resourceFilePath(path);
      if (roots.has(file)) return;
      let entry = entries.get(file);
      if (!entry) {
        entry = { type, isReading, isListed, owners: [], addresses: [] };
        entries.set(file, entry);
        queue.push(file);
      } else if (isListed && !entry.isListed) {
        // The queue may have passed a judged-only file, so the read that lists it queues it again.
        entry.isListed = true;
        queue.push(file);
      }
      entry.type ??= type;
      // A judged-only read is one no value makes, so its owner does not read the file.
      if (isListed && owner !== null && !entry.owners.includes(owner)) entry.owners.push(owner);
      if (path !== file && !entry.addresses.includes(path)) entry.addresses.push(path);
    };
    for (const { owner, reads, isReading, isJudgedOnly } of starts)
      for (const read of reads) visit(owner, read, isReading, !isJudgedOnly);
    for (let next = 0; next < queue.length; next++) {
      const file = queue[next]!;
      if (!entries.get(file)!.isListed) continue;
      if (isGltfPath(file)) {
        for (const path of remapsOf(file))
          visit(file, { path, type: 'Material' }, false, !isFailedLoad(path));
      }
      if (!isGodotTextResourcePath(file)) continue;
      for (const read of textFile(file)?.reads ?? []) visit(file, read);
    }
    return entries;
  }

  function sceneFileOf(path: string, entry: Entry): SceneFile {
    const { state, reason } = stateOf(path, entry);
    const { type, owners, addresses } = entry;
    return { path, type, state, owners, reason, addresses };
  }

  function stateOf(path: string, { isReading, addresses }: Entry): Pick<SceneFile, 'state' | 'reason'> {
    const found = outcome(path);
    if (found === undefined || isReading) return { state: 'loading', reason: null };
    // Null: the host could not read a file that exists, which `loadOutcome` counts as no failure.
    if (found?.isFailed)
      return { state: 'missing', reason: { chain: found.chain, cause: found.cause, addresses: [] } };
    if (addresses.length === 0) return { state: 'loaded', reason: null };
    const text = textFile(path);
    if (text === undefined) return { state: 'loading', reason: null };
    const undeclared = addresses.filter(
      (address) => !text?.subResourceIds.has(parseSubResourcePath(address).subResourceId ?? '')
    );
    return undeclared.length > 0
      ? { state: 'missing', reason: { chain: [undeclared[0]!], cause: 'missing', addresses: undeclared } }
      : { state: 'loaded', reason: null };
  }

  function releaseOutside(files: ReadonlyMap<string, Entry>): void {
    for (const file of pinnedOutcomes) {
      if (files.has(file)) continue;
      pinnedOutcomes.delete(file);
      loader.loadOutcomes.unpin(file);
    }
    for (const file of pinnedParses) {
      if (files.has(file)) continue;
      pinnedParses.delete(file);
      processorOf(file).unpin(file);
    }
    for (const file of pinnedModels) {
      if (files.has(file)) continue;
      pinnedModels.delete(file);
      loader.glbMeshes.unpin(file);
    }
    for (const file of textFiles.keys()) if (!files.has(file)) textFiles.delete(file);
    for (const file of modelRemaps.keys()) if (!files.has(file)) modelRemaps.delete(file);
  }

  // An invalidation drops the load in flight, and a pinned key asks for no other.
  function requestPinnedAgain(busType: ResourceType, key: string): void {
    if (busType === 'loadoutcome' && pinnedOutcomes.has(key)) loader.loadOutcomes.request(key);
    else if (busType === 'glb' && pinnedModels.has(key)) loader.glbMeshes.request(key);
    else if (busType !== 'loadoutcome' && busType !== 'glb' && pinnedParses.has(key))
      processorOf(key).request(key);
  }

  const stopWatching = loader.eventBus.onChange(WATCHED, ({ busType, event, key }) => {
    if (busType === 'glb' && event === 'invalidated') modelRemaps.delete(key);
    else if (busType !== 'loadoutcome' && event === 'invalidated') textFiles.delete(key);
    if (event === 'invalidated') requestPinnedAgain(busType, key);
    if (!walkedPaths.has(key) && !textFiles.has(key)) return;
    walkedInput = null;
    onChange();
  });

  return {
    files(input) {
      if (input === walkedInput) return walked;
      walkedInput = input;
      const { starts, failing } = input;
      const entries = entriesFrom(starts);
      releaseOutside(entries);
      walkedPaths = new Set(entries.keys());
      const judged = [...entries]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([path, entry]) => ({ row: sceneFileOf(path, entry), isListed: entry.isListed }));
      const rows = judged.flatMap(({ row, isListed }) => (isListed ? [row] : []));
      const failure = failing
        ? sceneFailureOf(
            judged.map(({ row }) => row),
            failing
          )
        : null;
      const files = { files: rows, failure };
      const key = JSON.stringify(files);
      if (key !== walkedKey) {
        walked = files;
        walkedKey = key;
      }
      return walked;
    },
    dispose() {
      stopWatching();
      releaseOutside(new Map());
    },
  };
}

function textFileOf(file: string, parsed: TscnScene | ParsedResource): TextFile {
  return 'internalResources' in parsed
    ? { reads: sceneFileReads(file, parsed), subResourceIds: idsOf(parsed.internalResources) }
    : { reads: resourceFileReads(file, parsed), subResourceIds: idsOf(parsed.subResources) };
}

function idsOf(sections: readonly { readonly id: string }[]): ReadonlySet<string> {
  return new Set(sections.map((section) => section.id));
}
