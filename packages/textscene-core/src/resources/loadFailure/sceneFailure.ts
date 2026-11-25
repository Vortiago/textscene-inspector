import type { ParsedScene } from '../../core/SceneGraph.js';
import type { SceneFailure, SceneFile } from '../../scene/sceneFiles.js';
import { resourceFilePath } from '../subResourcePath.js';
import { sceneFailingFileReads, type FailingFileRead } from './fileReads.js';

/** A read of the root scene that fails the whole scene when it fails, with the line Godot prints for it. */
export interface FailingRead {
  readonly address: string;
  readonly line: string;
}

export function failingReadsOf(scene: ParsedScene): FailingRead[] {
  return sceneFailingFileReads(scene.path, scene).map((read) => ({
    address: read.path,
    line: godotFailureLine(scene.path, read),
  }));
}

/** Godot's error line, less its number, measured in 4.6.3 (resource_format_text.cpp:40, :152, :291). */
function godotFailureLine(scenePath: string, { path, kind, uid }: FailingFileRead): string {
  if (kind === 'section ExtResource')
    return `${scenePath} - Parse Error: [ext_resource] referenced non-existent resource at: ${path}.`;
  if (kind === 'section Resource')
    return `${scenePath} - Parse Error: Can't load resource at path: ${path} with uid: ${uid}.`;
  return `Parse Error: Parse error. [Resource file ${scenePath}]`;
}

/** `files` with the failure of the first failing read: a whole file, or the undeclared address it names. */
export function withSceneFailure(
  files: readonly SceneFile[],
  reads: readonly FailingRead[]
): readonly SceneFile[] {
  if (reads.length === 0) return files;
  const indexByPath = new Map(files.map((file, index) => [file.path, index]));
  for (const read of reads) {
    const index = indexByPath.get(resourceFilePath(read.address));
    if (index === undefined) continue;
    const file = files[index]!;
    // A read still loading may yet fail first, so no later read names the failure.
    if (file.state === 'loading') return files;
    const failure = failureThrough(file, read);
    if (!failure) continue;
    const marked = files.slice();
    marked[index] = { ...file, sceneFailure: failure };
    return marked;
  }
  return files;
}

function failureThrough({ reason }: SceneFile, { address, line }: FailingRead): SceneFailure | null {
  if (!reason) return null;
  if (reason.addresses.length === 0) return { line, chain: reason.chain };
  return reason.addresses.includes(address) ? { line, chain: [address] } : null;
}
