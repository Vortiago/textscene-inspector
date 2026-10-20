/**
 * The read of an asset's **Import sidecar** (ADR-0028) that every processor shares. A sidecar is
 * found by convention (`scene.gltf.import`), so it is read with `tryLoad`: absent means import
 * defaults, not a **Missing resource**.
 */

import type { DependentRead } from './dependentRead';
import { parseImportFile, type ParsedImportFile } from '../../parser/importParser';
import { importSidecarPath } from '../../godot/project/resourceFormats.js';

/** The sidecar of the read's asset, or null for none. */
export async function readImportSidecar({
  assetPath,
  dependent,
  fileEventBus,
  dependencies,
}: DependentRead): Promise<ParsedImportFile | null> {
  if (!fileEventBus) return null;
  const sidecar = importSidecarPath(assetPath);
  dependencies.record(dependent, sidecar);
  const raw = await fileEventBus.tryLoad(sidecar, 'ImportSidecar');
  return typeof raw === 'string' ? parseImportFile(raw) : null;
}
