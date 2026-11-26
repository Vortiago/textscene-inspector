import { useMemo } from 'react';
import * as THREE from 'three';
import { isBottomUp, reversedRows } from '../../utils/reversedRows';
import { useDisposeOnRelease } from '../useDisposeOnRelease';

interface StoredLevel {
  data: Uint8Array | Uint16Array | Float32Array;
  width: number;
  height: number;
}

/** `texture` with Godot's top row at v = 0, since the template uploads with no flip: bottom-up reversed. */
export function useTopRowFirst(texture: THREE.Texture | null): THREE.Texture | null {
  const version = texture?.version;
  const copy = useMemo(
    () => (texture && isBottomUp(texture) ? topRowFirstCopy(texture) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the version keys the copy, so later texels reach it.
    [texture, version]
  );
  useDisposeOnRelease(copy);
  return copy ?? texture;
}

function topRowFirstCopy(texture: THREE.Texture): THREE.Texture {
  const copy = texture.clone();
  // A clone shares its source's `Source`, so the copy takes a `Source` of its own.
  copy.source = new THREE.Source(reversedLevel(texture.image as StoredLevel));
  copy.mipmaps = (texture.mipmaps as StoredLevel[]).map(reversedLevel);
  copy.needsUpdate = true;
  return copy;
}

function reversedLevel({ data, width, height }: StoredLevel): StoredLevel {
  return { data: reversedRows(data, width, height), width, height };
}
