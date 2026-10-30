/**
 * The texture of each node icon. Godot uploads an editor icon without mipmaps, so a minified icon
 * samples linearly from the 128 px image (`create_icon_material` leaves the texture as `get_icon`
 * returned it, `node_3d_editor_gizmos.cpp:949-985`).
 */

import * as THREE from 'three';
import { releasedOnUnmount } from '../sharedTexture';
import { editorIconDataUrl, type EditorIconName } from './editorIcons';

/** Written only by `editorIconTexture`, and never cleared. A canvas that unmounts frees each texture. */
const textures = new Map<EditorIconName, THREE.Texture>();

export function editorIconTexture(name: EditorIconName): THREE.Texture {
  const cached = textures.get(name);
  if (cached) return cached;

  const texture = new THREE.TextureLoader().load(editorIconDataUrl(name));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textures.set(name, releasedOnUnmount(texture));
  return texture;
}
