/**
 * The tiles a TileSet holds once Godot has loaded it. `create_tile` needs room in the atlas grid of
 * the texture's size (`tile_set.cpp:4985`, `:5200-5211`), and the texture reports its size as the
 * scene loads, before any ViewportTexture is set up (`viewport.cpp:156-160`). A texture saved in its
 * own file is sized from that file, so the caller loads it first.
 */

import type { LoadedFile } from '../scopedResource.js';
import { resolveExtResourceFilePath, unwrapCanvasTextureRef } from '../SubResourceResolver.js';
import {
  BEFORE_SETUP,
  extResourceTexture2DSize,
  inlineTexture2DSize,
  type Texture2DSize,
} from '../texture2DSize.js';
import type { AtlasSourceModel, TileSetModel, TileTexture } from './types';

/** The resource files the atlas textures of `model` are saved in, which size them at load. */
export function atlasTextureFiles(model: TileSetModel): string[] {
  return [...model.sources.values()].flatMap(({ texture }) => {
    const path = texture && textureFile(texture);
    return path ? [path] : [];
  });
}

/** `model` with no tile in an atlas whose texture reports no area at load. */
export function withTilesSizedAtLoad(model: TileSetModel, loadedFile: LoadedFile): TileSetModel {
  const sources = new Map<number, AtlasSourceModel>();
  for (const [id, source] of model.sources) {
    const isSizeless = source.texture !== null && isSizelessAtLoad(source.texture, loadedFile);
    sources.set(id, isSizeless ? { ...source, tiles: new Map() } : source);
  }
  return { ...model, sources };
}

function isSizelessAtLoad(texture: TileTexture, loadedFile: LoadedFile): boolean {
  const size = sizeAtLoad(texture, loadedFile);
  return size !== null && (size.x <= 0 || size.y <= 0);
}

/** Null for a texture only its image sizes, which has room for every tile its file states. */
function sizeAtLoad(texture: TileTexture, loadedFile: LoadedFile): Texture2DSize | null {
  const inline = inlineTexture2DSize(texture.ref, texture.internalResources, BEFORE_SETUP);
  if (inline) return inline;
  const path = textureFile(texture);
  const parsed = path ? loadedFile(path) : undefined;
  return parsed ? extResourceTexture2DSize(parsed, BEFORE_SETUP) : null;
}

function textureFile({ ref, externalResources, internalResources }: TileTexture): string | null {
  return resolveExtResourceFilePath(unwrapCanvasTextureRef(ref, internalResources), externalResources);
}
