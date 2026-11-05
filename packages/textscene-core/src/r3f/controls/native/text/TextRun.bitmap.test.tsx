/** `<TextRun>` over a BMFont: one quad for each glyph with ink, over the page texture, tinted by modulate. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { TextureFilter } from '../../../../godot/rendering/materials/textureFilter';
import { godotTextureFilterState } from '../../../../resources/textures/godotTextureFilter';
import { sRGBToLinearRGB } from '../../../../utils/colorSpace';
import type { BitmapFill } from '../../../../resources/fonts/font/types';
import { testBitmapMetrics } from './bitmapFontMetrics.testkit';
import { TextRun, type TextRunProps } from './TextRun';
import { shapeText } from './textLayout';

function layoutFor(text: string, outlineFills?: readonly BitmapFill[]) {
  return shapeText(text, {
    fontSizePx: 16,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 3,
    fontMetrics: testBitmapMetrics(undefined, outlineFills),
  });
}

/** Every mesh a run of `text` mounts: the glyph quads first, then a mesh for each hex-code box rectangle. */
async function meshes(text: string, props: Partial<TextRunProps> = {}) {
  const renderer = await ReactThreeTestRenderer.create(
    <TextRun layout={layoutFor(text)} fontSizePx={16} tint={{ r: 1, g: 1, b: 1, a: 1 }} {...props} />
  );
  return renderer.scene.findAllByType('Mesh').map((found) => found.instance as THREE.Mesh);
}

async function mesh(text: string, props: Partial<TextRunProps> = {}) {
  return (await meshes(text, props))[0]!;
}

const materialOf = (run: THREE.Mesh) => run.material as THREE.MeshBasicMaterial;

describe('<TextRun> over a BMFont', () => {
  it('mounts one quad for each glyph with ink', async () => {
    const run = await mesh('Hi H');

    expect(run.geometry.getAttribute('position').count).toBe(3 * 4);
  });

  it('samples the page sheet as raw sRGB bytes, with the canvas multiply', async () => {
    const material = materialOf(await mesh('H'));

    expect(material.map).toBeInstanceOf(THREE.DataTexture);
    expect(material.map?.colorSpace).toBe(THREE.NoColorSpace);
    expect(material.defines).toHaveProperty('CANVAS_SRGB_MULTIPLY');
  });

  it('decodes the page sheet for a Label3D, whose material multiplies in linear (`material.cpp:969,1218`)', async () => {
    const material = materialOf(await mesh('H', { glyphDrawer: 'label3D' }));

    expect(material.map?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(material.defines ?? {}).not.toHaveProperty('CANVAS_SRGB_MULTIPLY');
  });

  it('multiplies the page colour by the tint, with alpha as opacity', async () => {
    const tint = { r: 0.2, g: 1, b: 0.4, a: 0.5 };
    const material = materialOf(await mesh('H', { tint }));

    const [r, g, b] = sRGBToLinearRGB(tint.r, tint.g, tint.b);
    expect([material.color.r, material.color.g, material.color.b]).toEqual(
      [r, g, b].map((v) => expect.closeTo(v, 6))
    );
    expect(material.opacity).toBe(0.5);
  });

  it('mounts a hex-code box for a character the font lacks, and no quad for it', async () => {
    const [run, ...boxes] = await meshes('HzH');

    expect(run!.geometry.getAttribute('position').count).toBe(2 * 4);
    expect(boxes.length).toBeGreaterThan(0);
  });

  it('draws the outline fills when a stroke width asks for the outline pass', async () => {
    const outlineFill = { width: 64, height: 32, data: new Uint8Array(64 * 32 * 4).fill(7) };
    const run = await mesh('H', { layout: layoutFor('H', [outlineFill]), strokeWidthPx: 4 });
    const map = materialOf(run).map as THREE.DataTexture;

    expect(run.geometry.getAttribute('position').count).toBe(4);
    expect(map.image.data?.[0]).toBe(7);
  });

  it('draws no hex-code box for a Label3D, as a box has no UV rect to draw (`label_3d.cpp:357`)', async () => {
    expect(await meshes('HzH', { glyphDrawer: 'label3D' })).toHaveLength(1);
  });

  it('builds a mip chain on the page sheet of a mipmapped run', async () => {
    const textureFilter = godotTextureFilterState(TextureFilter.LINEAR_WITH_MIPMAPS);
    const map = materialOf(await mesh('H', { textureFilter, mipmapped: true })).map!;

    expect(map.generateMipmaps).toBe(true);
    expect(map.minFilter).toBe(THREE.LinearMipmapLinearFilter);
  });

  it('shares one page texture among the runs of a font that sample it alike', async () => {
    const layout = layoutFor('H');
    const [first, second] = await Promise.all([mesh('H', { layout }), mesh('H', { layout })]);

    expect(materialOf(first).map).toBe(materialOf(second).map);
  });
});
