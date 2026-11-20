import { isGodotTextResourcePath } from '../../godot/project/resourceFormats.js';
import type { SceneFile } from '../../scene/sceneFiles.js';
import { resourceReads, sceneReads, type FileRead } from '../loadFailure/fileReads.js';
import type { LoadOutcome } from '../loadFailure/loadOutcome.js';
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

export interface SceneFileWalk {
  /** The same array while no file moves. The caller passes the same starts while none moves. */
  files(starts: readonly WalkStart[]): readonly SceneFile[];
  /** Calls `listener` when a load answers for a file of the last walk. Returns the removal. */
  subscribe(listener: () => void): () => void;
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

export function createSceneFileWalk(loader: ResourceLoader): SceneFileWalk {
  /** Written only by `textFile` and the change listener. Null where the file does not parse. */
  const textFiles = new Map<string, TextFile | null>();
  /** Written only by `textFile`: held in the loader's cache until the walk keeps their reads. */
  const pinnedParses = new Set<string>();
  /** Written only by `outcome` and `unpinOutcomesOutside`: held in the loader's cache. */
  const pinnedOutcomes = new Set<string>();
  const listeners = new Set<() => void>();
  /** Written only by `files`: the starts of the last walk, which a load answer makes stale. */
  let walkedStarts: readonly WalkStart[] | null = null;
  let walked: readonly SceneFile[] = [];
  let walkedKey = '';

  function textFile(file: string): TextFile | null | undefined {
    if (textFiles.has(file)) return textFiles.get(file);
    const processor = fileExtension(file) === '.tscn' ? loader.scenes : loader.resources;
    if (processor.getCached(file) === undefined) {
      if (!pinnedParses.has(file)) {
        pinnedParses.add(file);
        processor.pin(file);
        processor.request(file);
      }
      return undefined;
    }
    if (pinnedParses.delete(file)) processor.unpin(file);
    const parsed = parsedTextFile(file);
    textFiles.set(file, parsed);
    return parsed;
  }

  function parsedTextFile(file: string): TextFile | null {
    if (fileExtension(file) === '.tscn') {
      const scene = loader.scenes.getCached(file);
      return scene
        ? { reads: sceneReads(file, scene), subResourceIds: idsOf(scene.internalResources) }
        : null;
    }
    const parsed = loader.resources.getCached(file);
    return parsed ? { reads: resourceReads(file, parsed), subResourceIds: idsOf(parsed.subResources) } : null;
  }

  function outcome(file: string): LoadOutcome | null | undefined {
    const cached = loader.loadOutcomes.getCached(file);
    if (cached === undefined && !pinnedOutcomes.has(file)) {
      pinnedOutcomes.add(file);
      loader.loadOutcomes.pin(file);
      loader.loadOutcomes.request(file);
    }
    return cached;
  }

  function entriesFrom(starts: readonly WalkStart[]): Map<string, Entry> {
    const engineReads = new Set(starts.flatMap((start) => (start.owner === null ? start.reads : [])));
    const isEngineRead = (file: string) => [...engineReads].some((read) => read.path === file);
    // The scene is where the walk starts, not a file it loads.
    const roots = new Set(
      starts.flatMap(({ owner }) => (owner === null || isEngineRead(owner) ? [] : [owner]))
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
    for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
      if (!isGodotTextResourcePath(file)) continue;
      for (const read of textFile(file)?.reads ?? []) visit(file, read);
    }
    return entries;
  }

  function sceneFileOf(path: string, entry: Entry): SceneFile {
    const { state, reason } = stateOf(path, entry);
    return { path, type: entry.type, state, owners: entry.owners, reason, addresses: entry.addresses };
  }

  function stateOf(path: string, { isReading, addresses }: Entry): Pick<SceneFile, 'state' | 'reason'> {
    const found = outcome(path);
    if (found === undefined || isReading) return { state: 'loading', reason: null };
    if (found === null) return { state: 'missing', reason: { chain: [path], cause: 'missing' } };
    if (found.isFailed) return { state: 'missing', reason: { chain: found.chain, cause: found.cause } };
    if (addresses.length === 0) return { state: 'loaded', reason: null };
    const text = textFile(path);
    if (text === undefined) return { state: 'loading', reason: null };
    const undeclared = addresses.find(
      (address) => !text?.subResourceIds.has(parseSubResourcePath(address).subResourceId ?? '')
    );
    return undeclared
      ? { state: 'missing', reason: { chain: [undeclared], cause: 'missing' } }
      : { state: 'loaded', reason: null };
  }

  function unpinOutcomesOutside(files: ReadonlyMap<string, Entry>): void {
    for (const file of pinnedOutcomes) {
      if (files.has(file)) continue;
      pinnedOutcomes.delete(file);
      loader.loadOutcomes.unpin(file);
    }
  }

  const stopWatching = loader.eventBus.onChange(WATCHED, ({ busType, event, key }) => {
    if (busType !== 'loadoutcome' && event === 'invalidated') textFiles.delete(key);
    if (busType === 'loadoutcome' && event === 'invalidated' && pinnedOutcomes.has(key))
      loader.loadOutcomes.request(key);
    if (!walked.some((file) => file.path === key) && !textFiles.has(key)) return;
    walkedStarts = null;
    for (const listener of [...listeners]) listener();
  });

  return {
    files(starts) {
      if (starts === walkedStarts) return walked;
      walkedStarts = starts;
      const entries = entriesFrom(starts);
      unpinOutcomesOutside(entries);
      const files = [...entries.keys()].sort().map((path) => sceneFileOf(path, entries.get(path)!));
      const key = JSON.stringify(files);
      if (key !== walkedKey) {
        walked = files;
        walkedKey = key;
      }
      return walked;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      stopWatching();
      listeners.clear();
      unpinOutcomesOutside(new Map());
    },
  };
}

function idsOf(sections: readonly { readonly id: string }[]): ReadonlySet<string> {
  return new Set(sections.map((section) => section.id));
}
