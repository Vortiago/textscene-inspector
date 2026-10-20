import { describe, expect, it, vi } from 'vitest';
import { FileEventBus } from '../FileEventBus';
import { DependencyGraph } from '../dependencyGraph';
import { readImportSidecar } from './readImportSidecar';

const ASSET = 'res://art/grey.png';
const READER = { busType: 'texture', key: ASSET } as const;

function busServing(files: Record<string, string>): FileEventBus {
  return new FileEventBus({ loadResource: vi.fn(async (path: string) => files[path] ?? null) });
}

function readOf(fileEventBus: FileEventBus | undefined, dependencies: DependencyGraph) {
  return { assetPath: ASSET, dependent: READER, fileEventBus, dependencies };
}

describe('readImportSidecar', () => {
  it('parses the sidecar beside the asset', async () => {
    const bus = busServing({ [`${ASSET}.import`]: '[remap]\n\nimporter="texture"\n' });
    const sidecar = await readImportSidecar(readOf(bus, new DependencyGraph()));
    expect(sidecar?.importer).toBe('texture');
  });

  it('gives null for an asset with no sidecar, and records the read so a new one reloads it', async () => {
    const dependencies = new DependencyGraph();
    const sidecar = await readImportSidecar(readOf(busServing({}), dependencies));
    expect([sidecar, dependencies.release(`${ASSET}.import`)]).toEqual([null, [READER]]);
  });

  it('gives null and records nothing without a file bus (edge case)', async () => {
    const dependencies = new DependencyGraph();
    const sidecar = await readImportSidecar(readOf(undefined, dependencies));
    expect([sidecar, dependencies.release(`${ASSET}.import`)]).toEqual([null, []]);
  });
});
