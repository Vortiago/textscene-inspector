/**
 * Integration against the vendored hexagonal map (scenes/demos/2d/hexagonal_map/,
 * godot-demo-projects, MIT): the real map.tscn parses, its real tileset.tres
 * resolves (26 atlas sources, HEXAGON / vertical offset axis / 110×94), and
 * known cells decode to hand-computed map_to_local centers — the end-to-end
 * guard for half-offset / hexagon placement support.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { TscnParser } from '../../../../parser/TscnParser';
import { parseTresFile } from '../../../../parser/parsedResource';
import { tileSetFromTres } from '../../../../resources/tileset/resolveTileSet';
import { mapToLocalPx } from '../../../../resources/tileset/tilePlacement';
import { TILE_SHAPE_HEXAGON } from '../../../../resources/tileset/tileSetModel';
import { findByType } from './findByType';
import type { TileMapLayerProperties } from './types';

const here = dirname(fileURLToPath(import.meta.url));
const hexRoot = resolve(here, '../../../../../../../scenes/demos/2d/hexagonal_map');
const mapContent = readFileSync(resolve(hexRoot, 'map.tscn'), 'utf8');
const tilesetContent = readFileSync(resolve(hexRoot, 'tileset.tres'), 'utf8');

describe('hexagonal map integration', () => {
  const scene = new TscnParser().parse(mapContent);
  const layers = findByType(scene.nodes, 'TileMapLayer');

  it('parses the map: one TileMapLayer with decoded packed-byte cells', () => {
    expect(layers).toHaveLength(1);
    const cells = (layers[0]!.properties as TileMapLayerProperties).cells;
    expect(cells).not.toBeNull();
    expect(cells!.length).toBeGreaterThan(0);
  });

  it('resolves the real tileset.tres: HEXAGON, vertical offset axis, 110×94, 26 sources', () => {
    const model = tileSetFromTres(parseTresFile(tilesetContent));
    expect(model).not.toBeNull();
    expect(model!.shape).toBe(TILE_SHAPE_HEXAGON);
    expect(model!.offsetAxis).toBe(1);
    expect(model!.tileSize).toEqual({ x: 110, y: 94 });
    expect(model!.sources.size).toBe(26);
  });

  it('places the first decoded cells at hand-computed hexagon centers', () => {
    const cells = (layers[0]!.properties as TileMapLayerProperties).cells!;
    expect(cells[0]).toEqual({
      coords: { x: 5, y: -7 },
      sourceId: 0,
      atlasCoords: { x: 0, y: 0 },
      alternativeId: 0,
    });

    const model = tileSetFromTres(parseTresFile(tilesetContent))!;
    // Vertical axis STACKED: odd column ⇒ y += 0.5, then x *= 0.75 (hexagon overlap).
    // x = (5·0.75 + 0.5)·110 = 467.5; y = (−7 + 0.5 + 0.5)·94 = −564.
    expect(mapToLocalPx(model, { x: 5, y: -7 })).toEqual({ x: 467.5, y: -564 });
    // Even column (6, −7): no stagger ⇒ x = (6·0.75 + 0.5)·110 = 550; y = (−7 + 0.5)·94 = −611.
    expect(cells[1]!.coords).toEqual({ x: 6, y: -7 });
    expect(mapToLocalPx(model, { x: 6, y: -7 })).toEqual({ x: 550, y: -611 });
  });
});
