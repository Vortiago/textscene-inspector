import type { SceneFailure, SceneFile } from '../../scene/sceneFiles.js';
import { resourceFilePath } from '../subResourcePath.js';
import type { FailingFileRead } from './fileReads.js';

/** `files` with the failure of the first failing read: a whole file, or the undeclared address it names. */
export function withSceneFailure(
  files: readonly SceneFile[],
  scenePath: string,
  reads: readonly FailingFileRead[]
): readonly SceneFile[] {
  if (reads.length === 0) return files;
  const indexByPath = new Map(files.map((file, index) => [file.path, index]));
  for (const read of reads) {
    const index = indexByPath.get(resourceFilePath(read.path));
    if (index === undefined) continue;
    const file = files[index]!;
    // A read still loading may yet fail first, so no later read names the failure.
    if (file.state === 'loading') return files;
    const failure = failureThrough(file, scenePath, read);
    if (!failure) continue;
    const marked = files.slice();
    marked[index] = { ...file, sceneFailure: failure };
    return marked;
  }
  return files;
}

function failureThrough(
  { reason }: SceneFile,
  scenePath: string,
  read: FailingFileRead
): SceneFailure | null {
  if (!reason) return null;
  const { cause } = reason;
  if (reason.addresses.length === 0)
    return { line: godotFailureLine(scenePath, read), chain: reason.chain, cause };
  if (!reason.addresses.includes(read.path)) return null;
  return { line: godotFailureLine(scenePath, read), chain: [read.path], cause };
}

/** Godot's error line, measured in 4.6.3 (resource_format_text.cpp:40, :152, :291). */
function godotFailureLine(scenePath: string, { path, kind, uid, line }: FailingFileRead): string {
  if (kind === 'section ExtResource')
    return `${scenePath}:${line} - Parse Error: [ext_resource] referenced non-existent resource at: ${path}.`;
  if (kind === 'section Resource')
    return `${scenePath}:${line} - Parse Error: Can't load resource at path: ${path} with uid: ${uid}.`;
  return `Parse Error: Parse error. [Resource file ${scenePath}:${line}]`;
}
