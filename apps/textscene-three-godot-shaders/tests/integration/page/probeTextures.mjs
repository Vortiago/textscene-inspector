import * as THREE from 'three';

const levelSize = (size, level) => Math.max(size >> level, 1);

/** The bytes of a texel and three's format, for each format a spec names. */
const FORMATS = { rgba8: { bytes: 4, format: THREE.RGBAFormat }, rg8: { bytes: 2, format: THREE.RGFormat } };

const formatOf = (spec) => FORMATS[spec.format ?? 'rgba8'];

const bytesOf = (hex) => Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));

/** Layer `layer` of level `level`, of a level that holds `count` layers one after the other. */
function layerOf(spec, level, layer) {
  const size = levelSize(spec.width, level) * levelSize(spec.height, level) * formatOf(spec).bytes;
  return bytesOf(spec.levels[level]).slice(layer * size, (layer + 1) * size);
}

const mipmapsOf = (spec, data) =>
  spec.levels.map((_, level) => ({
    data: data(level),
    width: levelSize(spec.width, level),
    height: levelSize(spec.height, level),
  }));

function created(spec) {
  const { width, height, depth = 1 } = spec;
  switch (spec.kind) {
    case 'flat': {
      const texture = new THREE.DataTexture(layerOf(spec, 0, 0), width, height);
      if (spec.levels.length > 1) texture.mipmaps = mipmapsOf(spec, (level) => layerOf(spec, level, 0));
      return texture;
    }
    case 'layers': {
      const texture = new THREE.DataArrayTexture(bytesOf(spec.levels[0]), width, height, depth);
      texture.format = formatOf(spec).format;
      if (spec.levels.length > 1) texture.mipmaps = mipmapsOf(spec, (level) => bytesOf(spec.levels[level]));
      return texture;
    }
    case 'volume': {
      const texture = new THREE.Data3DTexture(bytesOf(spec.levels[0]), width, height, depth);
      if (spec.levels.length > 1)
        texture.mipmaps = spec.levels.map((level, index) => ({
          data: bytesOf(level),
          width: levelSize(width, index),
          height: levelSize(height, index),
          depth: levelSize(depth, index),
        }));
      return texture;
    }
    case 'cube':
      return new THREE.CubeTexture(
        Array.from({ length: 6 }, (_, face) => new THREE.DataTexture(layerOf(spec, 0, face), width, height))
      );
  }
  throw new Error(`expected a texture kind of flat, layers, volume or cube, got ${spec.kind}`);
}

/** The three texture of a probe's texture spec, as Godot's harness builds the same texels. */
export function textureOf(spec) {
  if (spec === null) return null;
  const texture = created(spec);
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** A spec, a list of them, or null. */
export const textureValue = (spec) => (Array.isArray(spec) ? spec.map(textureOf) : textureOf(spec));
