import * as THREE from 'three';
import { isBottomUp, reversedRows } from '../../utils/reversedRows';
import { perObject } from '../../utils/perObject';

interface Pixels {
  data: Uint8Array | Uint16Array | Float32Array;
  width: number;
  height: number;
}

const topDownCopyOf = perObject(
  (texture: THREE.Texture): THREE.Texture => {
    const copy = texture.clone();
    copy.source = new THREE.Source(topDownPixels(texture.image as Pixels));
    copy.mipmaps = texture.mipmaps.map((level) => topDownPixels(level as Pixels));
    return copy;
  },
  { stamp: (texture) => texture.version }
);

/** A transpiled shader samples with Godot's top-left origin, so a bottom-up typed array reverses its rows. */
export function topDownTexture(texture: THREE.Texture): THREE.Texture {
  if (!isBottomUp(texture) || texture.format !== THREE.RGBAFormat) return texture;
  return topDownCopyOf(texture);
}

function topDownPixels({ data, width, height }: Pixels): Pixels {
  return { data: reversedRows(data, width, height), width, height };
}
