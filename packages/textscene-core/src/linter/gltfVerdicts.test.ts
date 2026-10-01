/** The refused extensions of each used glTF, kept per provider under the file's stamp, so an unchanged file is read once. */

import { describe, expect, it } from 'vitest';
import { GltfVerdicts } from './gltfVerdicts.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';
import type { TscnExternalResource } from '../parser/types.js';
import { triangleGlb } from '../resources/formats/glb/testing/triangleGlb.js';

const TREE: TscnExternalResource = { id: '1_tree', path: 'res://tree.glb', type: 'PackedScene' };
const INSTANCED_TREE = triangleGlb({ extensionsRequired: ['EXT_mesh_gpu_instancing'], instanced: true });

/** A provider over `files` that counts its reads, stamped from `stamps` when given. */
function counting(files: Record<string, ArrayBuffer | string>, stamps?: Record<string, string>) {
  let reads = 0;
  const provider: ResourceProvider = {
    loadResource: async (path) => {
      reads++;
      return files[path] ?? null;
    },
    ...(stamps ? { stamp: async (path: string) => stamps[path] ?? null } : {}),
  };
  return { provider, reads: () => reads };
}

describe('GltfVerdicts', () => {
  it("names the file's refused required extensions", async () => {
    const { provider } = counting({ 'res://tree.glb': INSTANCED_TREE });
    expect(await new GltfVerdicts().refused(provider, TREE)).toEqual(['EXT_mesh_gpu_instancing']);
  });

  it('keeps the verdict of an unchanged file and reads it once', async () => {
    const { provider, reads } = counting({ 'res://tree.glb': INSTANCED_TREE }, { 'res://tree.glb': '1:144' });
    const verdicts = new GltfVerdicts();

    await verdicts.refused(provider, TREE);
    expect(await verdicts.refused(provider, TREE)).toEqual(['EXT_mesh_gpu_instancing']);
    expect(reads()).toBe(1);
  });

  it('reads the file again when its stamp changes, and keeps the new verdict', async () => {
    const files: Record<string, ArrayBuffer | string> = { 'res://tree.glb': INSTANCED_TREE };
    const stamps = { 'res://tree.glb': '1:144' };
    const { provider, reads } = counting(files, stamps);
    const verdicts = new GltfVerdicts();
    await verdicts.refused(provider, TREE);

    files['res://tree.glb'] = triangleGlb({});
    stamps['res://tree.glb'] = '2:120';

    expect(await verdicts.refused(provider, TREE)).toEqual([]);
    expect(reads()).toBe(2);
  });

  it('reads the file on every call for a provider without a stamp', async () => {
    const { provider, reads } = counting({ 'res://tree.glb': INSTANCED_TREE });
    const verdicts = new GltfVerdicts();

    await verdicts.refused(provider, TREE);
    await verdicts.refused(provider, TREE);

    expect(reads()).toBe(2);
  });

  it('reads the file again when its stamp is null', async () => {
    const { provider, reads } = counting({ 'res://tree.glb': INSTANCED_TREE }, {});
    const verdicts = new GltfVerdicts();

    await verdicts.refused(provider, TREE);
    await verdicts.refused(provider, TREE);

    expect(reads()).toBe(2);
  });

  it('reads the file again when the stamp read rejects, and forgets the older verdict', async () => {
    const stamps: Record<string, string> = { 'res://tree.glb': '1:144' };
    const { provider, reads } = counting({ 'res://tree.glb': INSTANCED_TREE }, stamps);
    const verdicts = new GltfVerdicts();
    await verdicts.refused(provider, TREE);

    const stamp = provider.stamp!;
    provider.stamp = () => Promise.reject(new Error('stat failed'));
    await verdicts.refused(provider, TREE);
    provider.stamp = stamp;
    await verdicts.refused(provider, TREE);

    expect(reads()).toBe(3);
  });

  it('keeps one set of verdicts per provider', async () => {
    const a = counting({ 'res://tree.glb': INSTANCED_TREE }, { 'res://tree.glb': '1:144' });
    const b = counting({ 'res://tree.glb': triangleGlb({}) }, { 'res://tree.glb': '1:144' });
    const verdicts = new GltfVerdicts();

    await verdicts.refused(a.provider, TREE);

    expect(await verdicts.refused(b.provider, TREE)).toEqual([]);
    expect(b.reads()).toBe(1);
  });

  it('refuses nothing for a file the provider does not hold, or one whose read rejects', async () => {
    const rejecting: ResourceProvider = {
      loadResource: () => Promise.reject(new Error('Resource not found')),
    };
    const verdicts = new GltfVerdicts();

    expect(await verdicts.refused(counting({}).provider, TREE)).toEqual([]);
    expect(await verdicts.refused(rejecting, TREE)).toEqual([]);
  });
});
