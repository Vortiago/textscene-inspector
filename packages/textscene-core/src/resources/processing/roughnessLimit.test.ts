/**
 * The roughness limiter against Godot 4.6.3: `roughnessLimit.godot.json` holds five images and the
 * mip levels Godot's importer stored for each, read back from its `.ctex` files.
 */
import { describe, expect, it } from 'vitest';
import measured from './roughnessLimit.godot.json';
import { limitRoughness } from './roughnessLimit';
import { mipChain } from './mipChain';
import { RoughnessChannel } from '../../godot/import/textureImport';
import type { ImageSourceFormat } from '../../godot/import/imageSourceFormat';

type Case = (typeof measured.cases)[number];

function limitedLevels(sample: Case): number[][] {
  const base = { data: Uint8Array.from(sample.base), width: sample.width, height: sample.height };
  const levels = mipChain(base, false);
  const normal = measured.normals[sample.normal as keyof typeof measured.normals];
  limitRoughness(
    levels,
    { ...normal, data: Uint8Array.from(normal.data) },
    {
      channel: RoughnessChannel[sample.channel as keyof typeof RoughnessChannel],
      source: sample.source as ImageSourceFormat,
    }
  );
  return levels.map((level) => Array.from(level.data));
}

describe('limitRoughness', () => {
  it.each(measured.cases.map((sample) => [sample.name, sample] as const))(
    'stores the levels Godot stores for %s',
    (_name, sample) => {
      expect(limitedLevels(sample)).toEqual(sample.godotLevels);
    }
  );

  it('leaves the first level as it is, as Godot starts at level 1 (edge case)', () => {
    const base = { data: new Uint8Array([10, 20, 30, 255]), width: 1, height: 1 };
    const flat = { data: new Uint8Array([255, 128, 0, 255]), width: 1, height: 1 };
    limitRoughness([base], flat, { channel: RoughnessChannel.R, source: 'RGBA8' });
    expect(Array.from(base.data)).toEqual([10, 20, 30, 255]);
  });
});
