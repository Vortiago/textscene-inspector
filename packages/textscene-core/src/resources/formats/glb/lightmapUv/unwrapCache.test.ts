import { describe, expect, it } from 'vitest';
import { parseUnwrapCache } from './unwrapCache';
import { demoBytes } from './testing/globalIllumination';

describe('parseUnwrapCache', () => {
  it("reads zdm2's one entry: its hash, size hint and counts", () => {
    const [entry, ...rest] = parseUnwrapCache(demoBytes('zdm2.glb.unwrap_cache'));

    expect(rest).toEqual([]);
    expect(entry).toMatchObject({ hash: 'cf16ea077fd688f35e8b687b5ae52383', sizeHint: [1266, 1266] });
    expect([entry!.sourceVertices.length, entry!.uvs.length, entry!.indices.length]).toEqual([
      91276, 182552, 176310,
    ]);
  });

  it("reads the cube's entry: its hash, size hint and counts", () => {
    const [entry] = parseUnwrapCache(demoBytes('cube.glb.unwrap_cache'));

    expect(entry).toMatchObject({ hash: '9dfd97298732aae2cf6bb87e6dc2050f', sizeHint: [46, 30] });
    expect([entry!.sourceVertices.length, entry!.indices.length]).toEqual([24, 36]);
  });

  it('refuses a file cut inside an entry, naming the size it needs and the size it has', () => {
    const cut = demoBytes('cube.glb.unwrap_cache').slice(0, 100);

    expect(() => parseUnwrapCache(cut)).toThrow('unwrap cache: entry 0 needs 324 bytes, the file has 100');
  });

  it('refuses an entry count that overruns the file', () => {
    const bytes = demoBytes('cube.glb.unwrap_cache');
    new DataView(bytes).setInt32(0, 2, true);

    expect(() => parseUnwrapCache(bytes)).toThrow('unwrap cache: entry 1 needs 496 bytes, the file has 468');
  });

  it('reads an empty cache as no entries (edge case)', () => {
    expect(parseUnwrapCache(new Int32Array([0]).buffer)).toEqual([]);
  });
});
