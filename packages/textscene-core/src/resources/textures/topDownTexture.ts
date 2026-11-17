import * as THREE from 'three';
import { isBottomUp, reversedRows } from '../../utils/reversedRows';
import { perObject } from '../../utils/perObject';

interface Pixels {
  data: Uint8Array | Uint16Array | Float32Array;
  width: number;
  height: number;
}

/** One copy for each source, refilled on each change, so an edit leaves no stale copy on the GPU. */
interface TopDownCopy {
  readonly copy: THREE.Texture;
  version: number;
}

const topDownCopyOf = perObject((texture: THREE.Texture): TopDownCopy => {
  const copy = texture.clone();
  texture.addEventListener('dispose', () => copy.dispose());
  return { copy, version: -1 };
});

/** A transpiled shader samples with Godot's top-left origin, so a bottom-up typed array reverses its rows. */
export function topDownTexture(texture: THREE.Texture): THREE.Texture {
  if (!isBottomUp(texture) || texture.format !== THREE.RGBAFormat) return texture;
  const held = topDownCopyOf(texture);
  if (held.version !== texture.version) refill(held, texture);
  return held.copy;
}

function refill(held: TopDownCopy, texture: THREE.Texture): void {
  held.copy.source = new THREE.Source(topDownPixels(texture.image as Pixels));
  held.copy.mipmaps = texture.mipmaps.map((level) => topDownPixels(level as Pixels));
  held.copy.needsUpdate = true;
  held.version = texture.version;
}

function topDownPixels({ data, width, height }: Pixels): Pixels {
  return { data: reversedRows(data, width, height), width, height };
}
