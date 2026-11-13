/**
 * The `SKY` kind decodes a Sky with its material to one value from every origin: the Sky and its
 * material in the scene, in a `.tres` of the Sky's own, and inside another `.tres` (ADR-0071).
 */
import { describe, expect, it } from 'vitest';
import { loadedValue } from '../reading/reading.testkit';
import { SKY, type DecodedSky } from './kind';

const MATERIAL = '[sub_resource type="ProceduralSkyMaterial" id="m"]\nsky_curve = 0.3';
const SKY_BODY = 'process_mode = 3\nsky_material = SubResource("m")';

const summary = ({ sky, panorama }: DecodedSky) => ({ sky, panorama });

describe('SKY of a Sky over a ProceduralSkyMaterial', () => {
  const inScene = summary(
    loadedValue(SKY, 'SubResource("s")', `${MATERIAL}\n\n[sub_resource type="Sky" id="s"]\n${SKY_BODY}\n`)
  );

  it('reads the material and the bake of a Sky in the scene', () => {
    expect(inScene).toMatchObject({
      sky: { processMode: 'real-time', material: { kind: 'procedural', sky_curve: 0.3 } },
    });
  });

  it('decodes the same value from a .tres of its own', () => {
    const files = {
      'res://sky.tres': `[gd_resource type="Sky" format=3]\n\n${MATERIAL}\n\n[resource]\n${SKY_BODY}\n`,
    };
    const scene = '[ext_resource type="Sky" path="res://sky.tres" id="1_s"]';

    expect(summary(loadedValue(SKY, 'ExtResource("1_s")', scene, files))).toEqual(inScene);
  });

  it('decodes the same value from a sub-resource of another .tres', () => {
    const holder = `[gd_resource type="Resource" format=3]\n\n${MATERIAL}\n\n[sub_resource type="Sky" id="s"]\n${SKY_BODY}\n\n[resource]\n`;

    expect(summary(loadedValue(SKY, 'res://holder.tres::s', '', { 'res://holder.tres': holder }))).toEqual(
      inScene
    );
  });
});
