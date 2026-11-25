import { isGodotTextResourcePath } from '../../godot/project/resourceFormats.js';
import type { SceneFile } from '../../scene/sceneFiles.js';
import { resourceReads, sceneReads, type FailingFileRead, type FileRead } from '../loadFailure/fileReads.js';
import type { LoadOutcome } from '../loadFailure/loadOutcome.js';
import { withSceneFailure } from '../loadFailure/sceneFailure.js';
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
}

/** The root scene and its reads that fail the whole scene, in its read order. */
export interface SceneFailingReads {
  readonly scene: string;
  readonly reads: readonly FailingFileRead[];
}

/** What the walk reads from, one object so the starts and the failing reads cannot drift apart. */
export interface WalkInput {
  readonly starts: readonly WalkStart[];
  readonly failing: SceneFailingReads | null;
}

export interface SceneFileWalk {
  /** The same array while no file moves. The caller passes the same input while none moves. */
  files(input: WalkInput): readonly SceneFile[];
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
  readonly owners: string[];
  readonly addresses: string[];
}

const WATCHED: ResourceType[] = ['scene', 'resource', 'loadoutcome'];

/** `onChange` runs when a load answers for a file of the last walk. */
export function createSceneFileWalk(loader: ResourceLoader, onChange: () => void): SceneFileWalk {
  /** Written only by `textFile`, `releaseOutside` and the change listener. Null where a parse fails. */
  const textFiles = new Map<string, TextFile | null>();
  /** Written only by `textFile` and `releaseOutside`: held in the cache until the walk keeps the reads. */
  const pinnedParses = new Set<string>();
  /** Written only by `outcome` and `releaseOutside`: held in the loader's cache. */
  const pinnedOutcomes = new Set<string>();
  /** Written only by `files`: the starts of the last walk, which a load answer makes stale. */
  let walkedInput: WalkInput | null = null;
  let walked: readonly SceneFile[] = [];
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
    const visit = (owner: string | null, { path, type }: FileRead, isReading = false) => {
      const file = resourceFilePath(path);
      if (roots.has(file)) return;
      let entry = entries.get(file);
      if (!entry) {
        entry = { type, isReading, owners: [], addresses: [] };
        entries.set(file, entry);
        queue.push(file);
      }
      entry.type ??= type;
      if (owner !== null && !entry.owners.includes(owner)) entry.owners.push(owner);
      if (path !== file && !entry.addresses.includes(path)) entry.addresses.push(path);
    };
    for (const start of starts) for (const read of start.reads) visit(start.owner, read, start.isReading);
    for (let next = 0; next < queue.length; next++) {
      const file = queue[next]!;
      if (!isGodotTextResourcePath(file)) continue;
      for (const read of textFile(file)?.reads ?? []) visit(file, read);
    }
    return entries;
  }

  function sceneFileOf(path: string, entry: Entry): SceneFile {
    const { state, reason } = stateOf(path, entry);
    const { type, owners, addresses } = entry;
    return { path, type, state, owners, reason, addresses, sceneFailure: null };
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
    for (const file of textFiles.keys()) if (!files.has(file)) textFiles.delete(file);
  }

  const stopWatching = loader.eventBus.onChange(WATCHED, ({ busType, event, key }) => {
    if (busType !== 'loadoutcome' && event === 'invalidated') textFiles.delete(key);
    if (busType === 'loadoutcome' && event === 'invalidated' && pinnedOutcomes.has(key))
      loader.loadOutcomes.request(key);
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
      const rows = [...entries]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([path, entry]) => sceneFileOf(path, entry));
      const files = failing ? withSceneFailure(rows, failing.scene, failing.reads) : rows;
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
    ? { reads: sceneReads(file, parsed), subResourceIds: idsOf(parsed.internalResources) }
    : { reads: resourceReads(file, parsed), subResourceIds: idsOf(parsed.subResources) };
}

function idsOf(sections: readonly { readonly id: string }[]): ReadonlySet<string> {
  return new Set(sections.map((section) => section.id));
}
