import { describe, expect, it, vi } from 'vitest';
import { FileEventBus } from '../FileEventBus';
import { DependencyGraph } from '../dependencyGraph';
import { importTexture2DArraySlices } from '../../parser/importParser';
import { readLayeredSlices } from './readLayeredSlices';

const ASSET = 'res://bake.exr';

function readOf(files: Record<string, string>) {
  return {
    assetPath: ASSET,
    dependent: { busType: 'texture2darray', key: ASSET } as const,
    fileEventBus: new FileEventBus({ loadResource: vi.fn(async (path: string) => files[path] ?? null) }),
    dependencies: new DependencyGraph(),
  };
}

const sidecar = (importer: string, vertical = '3') =>
  `[remap]\n\nimporter="${importer}"\n\n[params]\n\nslices/horizontal=1\nslices/vertical=${vertical}\n`;

describe('readLayeredSlices', () => {
  it('reads the layer grid the sidecar names', async () => {
    const read = readOf({ [`${ASSET}.import`]: sidecar('2d_array_texture') });
    expect(await readLayeredSlices(read, importTexture2DArraySlices, 'a texture array')).toEqual({
      horizontal: 1,
      vertical: 3,
    });
  });

  it('refuses an asset with no sidecar, naming the import it expects (error case)', async () => {
    await expect(
      readLayeredSlices(readOf({}), importTexture2DArraySlices, 'a texture array')
    ).rejects.toThrow(`${ASSET} has no sidecar that imports it as a texture array`);
  });

  it('refuses a sidecar of another importer (edge case)', async () => {
    const read = readOf({ [`${ASSET}.import`]: sidecar('3d_texture') });
    await expect(readLayeredSlices(read, importTexture2DArraySlices, 'a texture array')).rejects.toThrow(
      'has no sidecar'
    );
  });
});
