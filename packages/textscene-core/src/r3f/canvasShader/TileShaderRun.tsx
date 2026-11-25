import { useMemo, type ReactNode } from 'react';
import type { Rgba } from '../../godot/math/math';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import type { DrawableCell } from '../../resources/tileset/drawableCell';
import { atlasGridSize } from '../../resources/tileset/paddedAtlas';
import type { AtlasSourceModel } from '../../resources/tileset/types';
import { imageSize } from '../../resources/formats/image/imagePixels';
import { useCanvasItemTextureSampledBy } from '../canvasItemTexture';
import type { CanvasItemTextureSampler } from '../canvasItemTextureSampler';
import { CanvasShaderSlot } from './CanvasShaderSlot';
import { useRuntimeAtlasTexture } from './paddedAtlasTexture';
import { tileRectCommands, type TileSetDraw } from './tileCommands';

interface TileShaderRunProps {
  shader: ShaderText;
  source: AtlasSourceModel;
  cells: readonly DrawableCell[];
  tileSet: TileSetDraw;
  /** `Item::final_modulate` of the tile item, in sRGB. */
  finalModulate: Rgba;
  sampler: CanvasItemTextureSampler;
  renderOrder: number;
  /** What the run draws while the translator loads, and for a shader it refuses. */
  fallback: ReactNode;
}

/** A tile item's run of one atlas source drawn as rects through a user's canvas_item shader. */
export function TileShaderRun({
  shader,
  source,
  cells,
  tileSet,
  finalModulate,
  sampler,
  renderOrder,
  fallback,
}: TileShaderRunProps) {
  const drawn = useCanvasItemTextureSampledBy(sampler, source.texture);
  const texture = useRuntimeAtlasTexture(drawn.texture ?? null, source);
  const commands = useMemo(() => {
    const textureSize = drawn.texture && imageSize(drawn.texture.image);
    return textureSize && tileRectCommands(cellsInAtlas(cells, source, textureSize), tileSet);
  }, [cells, source, drawn.texture, tileSet]);
  // A source with no texture, a pending one or a failed one draws nothing (`tile_map_layer.cpp:2676-2677`).
  if (!source.texture || drawn.missing || !texture || !commands) return null;
  return (
    <CanvasShaderSlot
      shader={shader}
      commands={commands}
      texture={texture}
      canvasTexture={drawn.canvasTexture ?? undefined}
      sampler={drawn.sampler}
      finalModulate={finalModulate}
      firstOrder={renderOrder}
      fallback={fallback}
    />
  );
}

/** The cells inside the texture's grid, which alone draw (`tile_map_layer.cpp:2680-2683`). */
function cellsInAtlas(
  cells: readonly DrawableCell[],
  source: AtlasSourceModel,
  textureSize: { width: number; height: number }
): readonly DrawableCell[] {
  const grid = atlasGridSize(source, textureSize);
  return cells.filter(({ atlasCoords: { x, y } }) => x < grid.x && y < grid.y);
}
