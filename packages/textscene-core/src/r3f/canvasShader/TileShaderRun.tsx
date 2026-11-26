import { useMemo, type ReactNode } from 'react';
import type { Rgba } from '../../godot/math/math';
import type { Vector2 } from '../../godot/math/vector';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { cellsInAtlasGrid, type DrawableCell } from '../../resources/tileset/drawableCell';
import type { AtlasSourceModel } from '../../resources/tileset/types';
import { imageSize } from '../../resources/formats/image/imagePixels';
import { useCanvasItemTextureSampledBy } from '../canvasItemTexture';
import type { CanvasItemTextureSampler } from '../canvasItemTextureSampler';
import type { AtlasCell } from '../../resources/useTexture2D';
import { atlasRectRegion, type CanvasShaderCommand } from './canvasCommands';
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
  /** `canvas_items_position` of the run's quadrant, where its canvas item sits in the layer. */
  itemOrigin: Vector2;
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
  itemOrigin,
  fallback,
}: TileShaderRunProps) {
  const drawn = useCanvasItemTextureSampledBy(sampler, source.texture);
  const runtimeAtlas = useRuntimeAtlasTexture(drawn, source);
  // An unpadded AtlasTexture draws its region from its whole atlas (`atlas_texture.cpp:180-191`).
  const atlasCell = source.usesTexturePadding ? undefined : drawn.atlasCell;
  const { x: originX, y: originY } = itemOrigin;
  const commands = useMemo(() => {
    const textureSize = drawn.texture && imageSize(drawn.texture.image);
    if (!textureSize) return null;
    const placed = cellsInAtlasGrid(cells, source, textureSize);
    const rects = tileRectCommands(placed, tileSet, { x: originX, y: originY });
    return atlasCell ? rectsOnAtlas(rects, atlasCell) : rects;
  }, [cells, source, drawn.texture, atlasCell, tileSet, originX, originY]);
  // A source with no texture, a pending one or a failed one draws nothing (`tile_map_layer.cpp:2676-2677`).
  if (!source.texture || drawn.missing || !drawn.texture) return null;
  // Nothing while the padded copy builds: the pending load holds the frame a capture waits for.
  if (runtimeAtlas === 'building') return null;
  // No size to place the cells by, or no pixels to pad: Godot's default shader draws the run.
  if (!commands || runtimeAtlas === 'unreadable') return <>{fallback}</>;
  const texture = atlasCell?.sheet ?? runtimeAtlas;
  // Object3Ds keep the layer's canvas key. The fallback draws in layer pixels, so it undoes the item's place.
  return (
    <object3D position={[itemOrigin.x, -itemOrigin.y, 0]}>
      <CanvasShaderSlot
        shader={shader}
        commands={commands}
        texture={texture}
        canvasTexture={drawn.canvasTexture ?? undefined}
        sampler={drawn.sampler}
        finalModulate={finalModulate}
        firstOrder={renderOrder}
        fallback={<object3D position={[-itemOrigin.x, itemOrigin.y, 0]}>{fallback}</object3D>}
      />
    </object3D>
  );
}

function rectsOnAtlas(rects: readonly CanvasShaderCommand[], atlasCell: AtlasCell): CanvasShaderCommand[] {
  return rects.flatMap((command): CanvasShaderCommand[] => {
    if (command.kind !== 'rect') return [command];
    const region = atlasRectRegion(command.region, atlasCell);
    return region ? [{ ...command, region }] : [];
  });
}
