/** `<TextRun>` over a BMFont: one quad for each glyph with ink, over the page texture, tinted by modulate. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { sRGBToLinearRGB } from '../../../../utils/colorSpace';
import { testBitmapMetrics } from './bitmapFontMetrics.testkit';
import { TextRun } from './TextRun';
import { shapeText } from './textLayout';

function layoutFor(text: string) {
  return shapeText(text, {
    fontSizePx: 16,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 3,
    fontMetrics: testBitmapMetrics(),
  });
}

async function mesh(text: string, tint = { r: 1, g: 1, b: 1, a: 1 }) {
  const renderer = await ReactThreeTestRenderer.create(
    <TextRun layout={layoutFor(text)} fontSizePx={16} tint={tint} />
  );
  return renderer.scene.findAllByType('Mesh')[0]!.instance as THREE.Mesh;
}

describe('<TextRun> over a BMFont', () => {
  it('mounts one quad for each glyph with ink', async () => {
    const run = await mesh('Hi H');

    expect(run.geometry.getAttribute('position').count).toBe(3 * 4);
  });

  it('samples the page sheet as raw sRGB bytes, with the canvas multiply', async () => {
    const material = (await mesh('H')).material as THREE.MeshBasicMaterial;

    expect(material.map).toBeInstanceOf(THREE.DataTexture);
    expect(material.map?.colorSpace).toBe(THREE.NoColorSpace);
    expect(material.defines).toHaveProperty('CANVAS_SRGB_MULTIPLY');
  });

  it('multiplies the page colour by the tint, with alpha as opacity', async () => {
    const tint = { r: 0.2, g: 1, b: 0.4, a: 0.5 };
    const material = (await mesh('H', tint)).material as THREE.MeshBasicMaterial;

    const [r, g, b] = sRGBToLinearRGB(tint.r, tint.g, tint.b);
    expect([material.color.r, material.color.g, material.color.b]).toEqual(
      [r, g, b].map((v) => expect.closeTo(v, 6))
    );
    expect(material.opacity).toBe(0.5);
  });

  it('mounts a hex-code box for a character the font lacks, and no quad for it', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextRun layout={layoutFor('HzH')} fontSizePx={16} tint={{ r: 1, g: 1, b: 1, a: 1 }} />
    );
    const run = renderer.scene.findAllByType('Mesh')[0]!.instance as THREE.Mesh;

    expect(run.geometry.getAttribute('position').count).toBe(2 * 4);
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(1);
  });
});
