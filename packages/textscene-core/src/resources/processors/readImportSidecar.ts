/**
 * The read of an asset's **Import sidecar** (ADR-0028) that every processor shares. A sidecar is
 * found by convention (`scene.gltf.import`), so it is read with `tryLoad`: absent means import
 * defaults, not a **Missing resource**.
 */

import type { FileEventBus } from '../FileEventBus';
import type { DependencyGraph, Dependent } from '../dependencyGraph';
import { parseImportFile, type ParsedImportFile } from '../../parser/importParser';
import { importSidecarPath } from '../../godot/project/resourceFormats.js';

/**
 * The sidecar of `assetPath`, or null for none. `dependent` is recorded as its reader before the
 * read, so a sidecar created, edited or deleted later reloads it.
 */
export async function readImportSidecar(
  assetPath: string,
  dependent: Dependent,
  fileEventBus: FileEventBus | undefined,
  dependencies: DependencyGraph
): Promise<ParsedImportFile | null> {
  if (!fileEventBus) return null;
  const sidecar = importSidecarPath(assetPath);
  dependencies.record(dependent, sidecar);
  const raw = await fileEventBus.tryLoad(sidecar, 'ImportSidecar');
  return typeof raw === 'string' ? parseImportFile(raw) : null;
}
