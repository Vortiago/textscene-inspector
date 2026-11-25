import type { SceneFailure, SceneFile } from '../../scene/sceneFiles.js';
import { resourceFilePath } from '../subResourcePath.js';
import type { FailingFileRead, ParseStop } from './fileReads.js';

/** The root scene, its reads that fail the whole scene in file order, and the read that stops its parse. */
export interface SceneFailingReads {
  readonly scene: string;
  readonly reads: readonly FailingFileRead[];
  readonly parseStop: ParseStop | null;
}

/** The first failure in file order: a read whose file fails, or the parse stop. Null while one may come. */
export function sceneFailureOf(
  files: readonly SceneFile[],
  { scene: scenePath, reads, parseStop }: SceneFailingReads
): SceneFailure | null {
  const byPath = new Map(files.map((file) => [file.path, file]));
  for (const read of reads) {
    const file = byPath.get(resourceFilePath(read.path));
    if (!file) continue;
    // A read still loading may yet fail first, so no later read names the failure.
    if (file.state === 'loading') return null;
    const failure = failureThrough(file, scenePath, read);
    if (failure) return failure;
  }
  return parseStop ? { line: godotStopLine(scenePath, parseStop), chain: [], cause: 'unparsed' } : null;
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

/** Godot's line for a read whose file fails, measured in 4.6.3 (resource_format_text.cpp:40, :152, :291). */
function godotFailureLine(scenePath: string, { path, kind, uid, line }: FailingFileRead): string {
  if (kind === 'section ExtResource')
    return `${scenePath}:${line} - Parse Error: [ext_resource] referenced non-existent resource at: ${path}.`;
  if (kind === 'section Resource')
    return `${scenePath}:${line} - Parse Error: Can't load resource at path: ${path} with uid: ${uid}.`;
  return `Parse Error: Parse error. [Resource file ${scenePath}:${line}]`;
}

/** Godot's line for the read that stops the parse, measured in 4.6.3 (resource_format_text.cpp:1185). */
function godotStopLine(scenePath: string, { read, place, isOpeningTag, line }: ParseStop): string {
  const at = `${scenePath}:${line}`;
  if (isOpeningTag) return `${at} - Parse Error: Unexpected end of file.`;
  if (place !== 'section') {
    const error = read.kind === 'SubResource' ? 'Invalid parameter.' : 'Parse error.';
    return `Parse Error: ${error} [Resource file ${at}]`;
  }
  if (read.kind === 'Refused') {
    const twice = read.twice === 'paths' ? 'Two non-uid paths' : 'Two uid:// paths';
    return `${at} - Parse Error: ${twice} in one Resource reference.`;
  }
  if (read.kind === 'ExtResource')
    return `${at} - Parse Error: Can't load cached ext-resource id: ${read.id}.`;
  return `${at} - Parse Error: .`;
}
