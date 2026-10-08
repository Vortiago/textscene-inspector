/**
 * <TileMapLayer> renders the layer's placed cells (decoded at parse time) as its rendering
 * quadrants, each a lit canvas item of batched textured quads. The TileSet resolves from the
 * scene's SubResources. An unresolvable TileSet or undecodable tile data degrades to the
 * transform-only group with children intact (ADR-0008).
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../../r3f/components/CanvasItem2D';
import { layerQuadrants } from '../../../../resources/tileset/renderingQuadrants';
import { TileQuadrants } from '../../../../r3f/TileQuadrants';
import { useTileSetModel } from '../../../../r3f/useTileSetModel';
import type { TileMapLayerProperties } from './types';

export function TileMapLayer({ node, children }: NodeComponentProps) {
  const props = node.properties as TileMapLayerProperties;
  const { model, status } = useTileSetModel(props.tile_set);
  const cells = props.cells ?? null;
  const {
    y_sort_enabled: ySortEnabled,
    y_sort_origin: ySortOrigin,
    rendering_quadrant_size: quadrantSize,
  } = props;

  // Parsed cells never change identity, so the batched geometries survive
  // unrelated re-renders and rebuild only on new data.
  const quadrants = useMemo(
    () =>
      model && cells?.length
        ? layerQuadrants(cells, model, { ySortEnabled, ySortOrigin, quadrantSize })
        : null,
    [model, cells, ySortEnabled, ySortOrigin, quadrantSize]
  );

  return (
    <CanvasItem2D
      node={node}
      props={props}
      ownItems={(tint, material, zFinal) =>
        props.enabled && status === 'loaded' && model && quadrants ? (
          <TileQuadrants
            quadrants={quadrants}
            model={model}
            tint={tint}
            material={material}
            lightMask={props.light_mask}
            zFinal={zFinal}
            name={node.name}
          />
        ) : null
      }
    >
      {children}
    </CanvasItem2D>
  );
}
