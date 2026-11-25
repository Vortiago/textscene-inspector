import type { ParsedScene } from '../../core/SceneGraph.js';
import type { SceneFailure, SceneFile } from '../../scene/sceneFiles.js';
import { resourceFilePath } from '../subResourcePath.js';
import { extResourcePathIn, sceneFailingReads } from './fileReads.js';

/** A read of the root scene that fails the whole scene when it fails, with the line Godot prints for it. */
export interface FailingRead {
  readonly address: string;
  readonly line: string;
}

export function failingReadsOf(scene: ParsedScene): FailingRead[] {
  return sceneFailingReads(scene.path, scene).map((address) => ({
    address,
    line: godotFailureLine(scene, address),
  }));
}

/** Godot's error line, less its number (resource_format_text.cpp:40, :152, :291). */
function godotFailureLine(scene: Pick<ParsedScene, 'path' | 'externalResources'>, read: string): string {
  const isExtResource = scene.externalResources.some(
    (ext) => extResourcePathIn(scene.path, ext.path) === read
  );
  return isExtResource
    ? `${scene.path} - Parse Error: [ext_resource] referenced non-existent resource at: ${read}.`
    : `Parse Error: Parse error. [Resource file ${scene.path}]`;
}

/** `files` with the failure of the first failing read: a whole file, or the undeclared address it names. */
export function withSceneFailure(
  files: readonly SceneFile[],
  reads: readonly FailingRead[]
): readonly SceneFile[] {
  const byPath = new Map(files.map((file) => [file.path, file]));
  for (const read of reads) {
    const file = byPath.get(resourceFilePath(read.address));
    const failure = file && failureThrough(file, read);
    if (failure) return files.map((row) => (row === file ? { ...row, sceneFailure: failure } : row));
  }
  return files;
}

function failureThrough({ reason }: SceneFile, { address, line }: FailingRead): SceneFailure | null {
  if (!reason) return null;
  if (reason.addresses.length === 0) return { line, chain: reason.chain };
  return reason.addresses.includes(address) ? { line, chain: [address] } : null;
}
