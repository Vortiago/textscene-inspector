import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  areaTexturePlacement,
  areaTextureUserData,
  holdAreaTexture,
  installAreaLightAtlas,
  releaseAreaTexture,
  updateAreaLightAtlas,
} from './areaLightAtlas';
import { AREA_LIGHT_ATLAS_UNIFORM } from './areaTextureFetch';
import { installedUniformValue } from '../shaderPatch/litUniform';

/** Where the atlas places a light that shows no texture. */
function untexturedPlacement() {
  return areaTexturePlacement(new THREE.RectAreaLight());
}

/** A `size × size` RGBA8 texture whose rows run bottom-up, as the procedural textures store them. */
function dataTexture(size: number, rgbaAtRow: (row: number) => readonly number[]): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) data.set(rgbaAtRow(row), (row * size + column) * 4);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

/** Mip 0's RGBA bytes at the atlas's top-left texel, as the lit programs sample it. */
function atlasCorner(): number[] {
  installAreaLightAtlas();
  const atlas = installedUniformValue(AREA_LIGHT_ATLAS_UNIFORM) as THREE.DataTexture;
  return [...(atlas.image.data as Uint8Array).subarray(0, 4)];
}

/** A light that shows `texture`, as an AreaLight3D hands it to the light pass. */
function lightShowing(texture: THREE.Texture): THREE.RectAreaLight {
  const light = new THREE.RectAreaLight();
  light.userData = areaTextureUserData(texture);
  return light;
}

const held: THREE.Texture[] = [];

function hold(texture: THREE.Texture): THREE.Texture {
  holdAreaTexture(texture);
  held.push(texture);
  return texture;
}

afterEach(() => {
  for (const texture of held.splice(0)) releaseAreaTexture(texture);
  updateAreaLightAtlas();
});

describe('the area light atlas', () => {
  it('places a held texture where Godot does', () => {
    const texture = hold(dataTexture(64, () => [255, 255, 255, 255]));

    updateAreaLightAtlas();

    expect(areaTexturePlacement(lightShowing(texture))).toEqual({
      rect: { x: 0, y: 0, width: 0.25, height: 0.25 },
      maxMipmap: 5,
    });
  });

  it("puts a bottom-up texture's last row at the atlas's top", () => {
    hold(dataTexture(2, (row) => (row === 0 ? [255, 0, 0, 255] : [0, 0, 255, 255])));

    updateAreaLightAtlas();

    expect(atlasCorner()).toEqual([0, 0, 255, 255]);
  });

  it("keeps a flipped texture's first row at the atlas's top, as a decoded image uploads (edge case)", () => {
    const texture = dataTexture(2, (row) => (row === 0 ? [255, 0, 0, 255] : [0, 0, 255, 255]));
    texture.flipY = true;
    hold(texture);

    updateAreaLightAtlas();

    expect(atlasCorner()).toEqual([255, 0, 0, 255]);
  });

  it("rebuilds once a held texture's pixels change", () => {
    const texture = dataTexture(2, () => [0, 0, 0, 255]);
    hold(texture);
    updateAreaLightAtlas();

    texture.image.data!.fill(255);
    texture.needsUpdate = true;
    updateAreaLightAtlas();

    expect(atlasCorner()).toEqual([255, 255, 255, 255]);
  });

  it('keeps a texture placed while a second holder holds it (edge case)', () => {
    const texture = hold(dataTexture(64, () => [255, 255, 255, 255]));
    holdAreaTexture(texture);
    updateAreaLightAtlas();

    releaseAreaTexture(texture);
    hold(dataTexture(64, () => [0, 0, 0, 255]));
    updateAreaLightAtlas();

    expect(areaTexturePlacement(lightShowing(texture))).not.toEqual(untexturedPlacement());
  });

  it('places nothing for a light without a texture (edge case)', () => {
    updateAreaLightAtlas();

    // An empty rectangle marks a light without a texture (4.7.2 `light_storage.cpp:1132-1141`).
    expect(untexturedPlacement()).toEqual({ rect: { x: 0, y: 0, width: 0, height: 0 }, maxMipmap: 0 });
  });

  it('places nothing for a texture whose pixels cannot be read (error case)', () => {
    const texture = hold(new THREE.Texture());

    updateAreaLightAtlas();

    expect(areaTexturePlacement(lightShowing(texture))).toEqual(untexturedPlacement());
  });
});
