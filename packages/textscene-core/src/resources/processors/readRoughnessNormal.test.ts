import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FileEventBus } from '../FileEventBus';
import { DependencyGraph } from '../dependencyGraph';
import { readRoughnessNormal } from './readRoughnessNormal';
import { decodeImagePixels } from '../formats/image/textureProcessing';
import { DEFAULT_TEXTURE_IMPORT, RoughnessChannel } from '../../godot/import/textureImport';

vi.mock('../formats/image/textureProcessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../formats/image/textureProcessing')>();
  return { ...actual, decodeImagePixels: vi.fn() };
});

const decode = vi.mocked(decodeImagePixels);
const PIXELS = { data: new Uint8Array([128, 128, 255, 255]), width: 1, height: 1 };
const READER = { busType: 'texture', key: 'res://rough.png' } as const;
const LIMITED = {
  ...DEFAULT_TEXTURE_IMPORT,
  mipmaps: true,
  roughnessLimit: { channel: RoughnessChannel.R, normalPath: 'res://bumps.png' },
};

function busOf(files: Record<string, ArrayBuffer>): FileEventBus {
  return new FileEventBus({ loadResource: vi.fn(async (path: string) => files[path] ?? null) });
}

describe('readRoughnessNormal', () => {
  beforeEach(() => {
    decode.mockReset();
    decode.mockResolvedValue(PIXELS);
  });

  it('decodes the normal map the sidecar names', async () => {
    const bus = busOf({ 'res://bumps.png': new ArrayBuffer(4) });

    const normal = await readRoughnessNormal(LIMITED, 'res://rough.png', READER, bus, new DependencyGraph());

    expect(normal).toBe(PIXELS);
  });

  it('records the roughness map as a reader of its normal map', async () => {
    const dependencies = new DependencyGraph();
    const bus = busOf({ 'res://bumps.png': new ArrayBuffer(4) });

    await readRoughnessNormal(LIMITED, 'res://rough.png', READER, bus, dependencies);

    expect(dependencies.release('res://bumps.png')).toEqual([READER]);
  });

  it('reads nothing for an import that builds no chain', async () => {
    const bus = busOf({ 'res://bumps.png': new ArrayBuffer(4) });
    const options = { ...LIMITED, mipmaps: false };

    expect(
      await readRoughnessNormal(options, 'res://rough.png', READER, bus, new DependencyGraph())
    ).toBeNull();
  });

  it('turns the limiter off for an absent normal map', async () => {
    expect(
      await readRoughnessNormal(LIMITED, 'res://rough.png', READER, busOf({}), new DependencyGraph())
    ).toBeNull();
  });

  it('turns the limiter off for a normal map that does not decode', async () => {
    decode.mockRejectedValueOnce(new Error('not an image'));
    const bus = busOf({ 'res://bumps.png': new ArrayBuffer(4) });

    expect(
      await readRoughnessNormal(LIMITED, 'res://rough.png', READER, bus, new DependencyGraph())
    ).toBeNull();
  });

  it('spells the normal map without the scheme for a host that does (edge case)', async () => {
    const bus = busOf({ 'bumps.png': new ArrayBuffer(4) });

    expect(await readRoughnessNormal(LIMITED, 'rough.png', READER, bus, new DependencyGraph())).toBe(PIXELS);
  });
});
