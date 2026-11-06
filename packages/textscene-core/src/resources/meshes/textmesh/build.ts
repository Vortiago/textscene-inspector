/**
 * TextMesh surface, ported from Godot 4.6.3 `TextMesh::_create_mesh_array`
 * (`scene/resources/3d/primitive_meshes.cpp:3204-3605`): the glyphs of each line as a front face at
 * +depth/2, a back face at -depth/2 and a quad for each side segment, or a hex code box for a
 * character the font lacks. UV, UV2 and `flip_faces` belong to the PrimitiveMesh base. Positions
 * are in metres, y up.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { blockStartY, lineStartOffset } from '../../../godot/math/alignment';
import { isZeroApprox, remapf } from '../../../godot/math/math';
import { normalizedVector2, type Vector2 } from '../../../godot/math/vector';
import {
  drawnOpentype,
  variationKey,
  withFallbacks,
  type FontMetrics,
  type GlyphVariation,
} from '../../../r3f/controls/native/text/fontMetrics';
import { hexCodeBoxAdvanceSize } from '../../../r3f/controls/native/text/hexCodeBox';
import type { SfntOutlines } from '../../../r3f/controls/native/text/sfntOutlines';
import {
  isControlChar,
  shapedTextSizeWidthPx,
  type GlyphPlacement,
} from '../../../r3f/controls/native/text/textLayout';
import { perObject } from '../../../utils/perObject';
import { recentlyRead } from '../../../utils/recentlyRead';
import type { GodotSurface } from '../godotSurface';
import { SurfaceWriter } from '../primitivemesh/surfaceWriter';
import { buildGlyphMeshData, type ContourInfo, type ContourVertex, type GlyphMeshData } from './glyphMesh';
import { shapeTextMeshLines, type TextMeshLines } from './textMeshLines';
import type { TextMeshProperties } from './types';

/**
 * What a TextMesh reads of its font: the metrics that shape the lines, carrying the outlines to
 * extrude. Each face of its **Fallback chain** carries its own.
 */
export type TextMeshFace = FontMetrics & { readonly outlines: SfntOutlines };

/** The faces of a TextMesh's **Fallback chain**, in the order the shaper tries them. */
export type TextMeshChain = readonly [TextMeshFace, ...TextMeshFace[]];

/** U+200B has no glyph to draw: the shaper gives it an advance of 0 (`textLayout.ts`). */
const ZERO_WIDTH_SPACE = 0x200b;

/** A glyph on the page: `x` is its pen origin and `y` its baseline, in metres. */
interface Origin {
  x: number;
  y: number;
}

interface OutlineGlyph extends Origin {
  mesh: GlyphMeshData;
}

/** The hex code box of a character the font lacks, with its size in metres. */
interface BoxGlyph extends Origin {
  box: Vector2;
}

type PlacedGlyph = OutlineGlyph | BoxGlyph;

const isOutline = (glyph: PlacedGlyph): glyph is OutlineGlyph => 'mesh' in glyph;

/** The box of the placed outlines in Godot's `min_p` and `max_p` (`:3340-3341`), which the UV spans. */
interface InkBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** A V range as `[at the bottom of the ink, at the top]`. */
type VRange = readonly [number, number];

/** The V each part takes (`:3441-3480`): a glyph with depth shares V among its front, back and sides. */
const FRONT_V_WITH_DEPTH: VRange = [0.4, 0];
const FRONT_V_FLAT: VRange = [1, 0];
const BACK_V: VRange = [0.8, 0.4];
/** The rows of a side segment's two edges, back and front, by the direction of its contour (`:3512-3516`). */
const COUNTER_CLOCKWISE_SIDE_ROWS = [0.8, 0.9] as const;
const CLOCKWISE_SIDE_ROWS = [0.9, 1] as const;

type Normal = readonly [number, number, number];
type Tangent = readonly [number, number, number, number];

const FRONT_NORMAL: Normal = [0, 0, 1];
const BACK_NORMAL: Normal = [0, 0, -1];
const FRONT_TANGENT: Tangent = [1, 0, 0, 1];
const BACK_TANGENT: Tangent = [-1, 0, 0, 1];

type GlyphMeshes = Map<number, GlyphMeshData | null>;

/** The settings kept per font. A slider drag makes one per value, so the least recently read go. */
const MAX_CACHED_SETTINGS_PER_FONT = 8;

/**
 * The glyph mesh data of one font by its `font_size`, `pixel_size`, `curve_step` and variation, then
 * by codepoint. Godot clears its cache when one of the first three changes (`:3043-3060`); the
 * embolden and skew change the contours, so they key it too. The cache belongs to the font, so two
 * meshes of one font at two sizes do not discard each other's glyphs on every edit.
 */
const glyphMeshCaches = perObject((_outlines: SfntOutlines) =>
  recentlyRead<string, GlyphMeshes>(MAX_CACHED_SETTINGS_PER_FONT)
);

/** The cache of `settings`, made if it is new. */
function cachedGlyphMeshes(outlines: SfntOutlines, settings: string): GlyphMeshes {
  return glyphMeshCaches(outlines)(settings, () => new Map());
}

/** Each glyph's mesh data, built once per font and settings, so a keystroke in `text` triangulates only the glyphs it adds. */
function glyphMeshes(
  properties: TextMeshProperties,
  face: TextMeshFace
): (codepoint: number) => GlyphMeshData | null {
  const { outlines } = face;
  const variation: GlyphVariation = {
    embolden: face.embolden,
    skew: face.skew,
    opentype: drawnOpentype(face),
  };
  const meshes = cachedGlyphMeshes(
    outlines,
    `${properties.fontSize}|${properties.pixelSize}|${properties.curveStep}|${variationKey(variation)}`
  );
  return (codepoint) => {
    if (!meshes.has(codepoint)) {
      const index = outlines.glyphIndex(codepoint, variation.opentype);
      meshes.set(
        codepoint,
        index === 0
          ? null
          : buildGlyphMeshData(
              outlines.glyphContours(index, properties.fontSize, variation),
              properties.pixelSize,
              properties.curveStep
            )
      );
    }
    return meshes.get(codepoint)!;
  };
}

/** The glyph meshes of each face a glyph draws in: the fallback the shaper gave it, else the first face. */
function glyphMeshesByFace(
  properties: TextMeshProperties,
  face: TextMeshFace,
  fallbacks: readonly TextMeshFace[]
): (glyph: GlyphPlacement) => GlyphMeshData | null {
  const meshesOf = perObject((glyphFace: TextMeshFace) => glyphMeshes(properties, glyphFace));
  const fallbackFaces = new Map<FontMetrics, TextMeshFace>(fallbacks.map((fallback) => [fallback, fallback]));
  return (glyph) => {
    const glyphFace = fallbackFaces.get(glyph.fontMetrics) ?? face;
    return meshesOf(glyphFace)(glyph.char.codePointAt(0)!);
  };
}

function placeGlyphs(
  properties: TextMeshProperties,
  { lines, baselineOffsetPx, linePitchPx }: TextMeshLines,
  meshOf: (glyph: GlyphPlacement) => GlyphMeshData | null
): PlacedGlyph[] {
  const { pixelSize } = properties;
  const blockHeight = lines.length * linePitchPx * pixelSize;
  const spacing = properties.lineSpacing * pixelSize;
  let lineTop =
    blockStartY(properties.verticalAlignment, blockHeight, spacing) + properties.offset.y * pixelSize;
  const placed: PlacedGlyph[] = [];
  for (const line of lines) {
    const startX =
      lineStartOffset(shapedTextSizeWidthPx(line.widthPx) * pixelSize, properties.horizontalAlignment) +
      properties.offset.x * pixelSize;
    const baseline = lineTop - baselineOffsetPx * pixelSize;
    for (const glyph of line.glyphs) {
      const codepoint = glyph.char.codePointAt(0)!;
      if (isControlChar(codepoint) || codepoint === ZERO_WIDTH_SPACE) continue;
      const origin = { x: startX + glyph.x * pixelSize, y: baseline };
      const mesh = meshOf(glyph);
      if (mesh) placed.push({ ...origin, mesh });
      else {
        const box = hexCodeBoxAdvanceSize(properties.fontSize, codepoint);
        placed.push({ ...origin, box: { x: box.x * pixelSize, y: box.y * pixelSize } });
      }
    }
    lineTop -= linePitchPx * pixelSize;
  }
  return placed;
}

function inkBounds(placed: readonly PlacedGlyph[]): InkBounds {
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const glyph of placed) {
    if (!isOutline(glyph)) continue;
    bounds.minX = Math.min(bounds.minX, glyph.mesh.min.x + glyph.x);
    bounds.maxX = Math.max(bounds.maxX, glyph.mesh.max.x + glyph.x);
    bounds.minY = Math.min(bounds.minY, glyph.mesh.min.y - glyph.y);
    bounds.maxY = Math.max(bounds.maxY, glyph.mesh.max.y - glyph.y);
  }
  return bounds;
}

class TextMeshWriter {
  private readonly writer = new SurfaceWriter(false);
  private readonly hasDepth: boolean;
  private readonly halfDepth: number;

  constructor(
    depth: number,
    private readonly bounds: InkBounds
  ) {
    this.hasDepth = !isZeroApprox(depth);
    this.halfDepth = depth / 2;
  }

  private uv(x: number, y: number, v: VRange): [number, number] {
    const { minX, maxX, minY, maxY } = this.bounds;
    return [remapf(x, minX, maxX, 0, 1), remapf(y, -maxY, -minY, v[0], v[1])];
  }

  private get frontV(): VRange {
    return this.hasDepth ? FRONT_V_WITH_DEPTH : FRONT_V_FLAT;
  }

  /** One triangle facing along `normal`, its corners in the order given. */
  private writeTriangle(
    corners: readonly Vector2[],
    z: number,
    normal: Normal,
    tangent: Tangent,
    v: VRange
  ): void {
    const first = this.writer.vertexCount;
    for (const { x, y } of corners) {
      this.writer.vertex([x, y, z], normal, tangent, this.uv(x, y, v), [0, 0]);
    }
    this.writer.triangle(first, first + 1, first + 2);
  }

  writeGlyph({ x, y, mesh }: OutlineGlyph): void {
    const corners = mesh.triangles.map((p) => ({ x: p.x + x, y: -p.y + y }));
    for (let k = 0; k < corners.length; k += 3) {
      const [a, b, c] = [corners[k]!, corners[k + 1]!, corners[k + 2]!];
      this.writeTriangle([a, b, c], this.halfDepth, FRONT_NORMAL, FRONT_TANGENT, this.frontV);
      if (this.hasDepth) this.writeTriangle([c, b, a], -this.halfDepth, BACK_NORMAL, BACK_TANGENT, BACK_V);
    }
    if (!this.hasDepth) return;
    mesh.contours.forEach((contour, i) => this.writeSides(contour, mesh.contoursInfo[i]!, x, y));
  }

  private writeSides(contour: readonly ContourVertex[], info: ContourInfo, x: number, y: number): void {
    const rows = info.isCounterClockwise ? COUNTER_CLOCKWISE_SIDE_ROWS : CLOCKWISE_SIDE_ROWS;
    let length = 0;
    contour.forEach((vertex, l) => {
      const previous = contour[l === 0 ? contour.length - 1 : l - 1]!;
      const next = contour[l + 1 === contour.length ? 0 : l + 1]!;
      const forward = normalizedVector2({
        x: next.point.x - vertex.point.x,
        y: next.point.y - vertex.point.y,
      });
      const backward = vertex.isSharp
        ? forward
        : normalizedVector2({ x: vertex.point.x - previous.point.x, y: vertex.point.y - previous.point.y });
      const segmentLength = Math.hypot(next.point.x - vertex.point.x, next.point.y - vertex.point.y);
      const first = this.writer.vertexCount;
      // Back and front of the segment's start, then of its end.
      const quad = [
        { point: vertex.point, z: -this.halfDepth, d: backward, along: length, row: rows[0] },
        { point: next.point, z: -this.halfDepth, d: forward, along: length + segmentLength, row: rows[0] },
        { point: vertex.point, z: this.halfDepth, d: backward, along: length, row: rows[1] },
        { point: next.point, z: this.halfDepth, d: forward, along: length + segmentLength, row: rows[1] },
      ];
      for (const { point, z, d, along, row } of quad) {
        this.writer.vertex(
          [point.x + x, -point.y + y, z],
          [d.y, d.x, 0],
          [d.x, -d.y, 0, 1],
          [remapf(along, 0, info.length, 0, 1), row],
          [0, 0]
        );
      }
      this.writer.triangle(first, first + 1, first + 2);
      this.writer.triangle(first + 1, first + 3, first + 2);
      length += segmentLength;
    });
  }

  writeBox({ x, y, box }: BoxGlyph): void {
    const first = this.writer.vertexCount;
    const corners = [
      { x, y },
      { x, y: y + box.y },
      { x: x + box.x, y: y + box.y },
      { x: x + box.x, y },
    ];
    for (const corner of corners) {
      this.writer.vertex(
        [corner.x, corner.y, 0],
        FRONT_NORMAL,
        FRONT_TANGENT,
        this.uv(corner.x, corner.y, this.frontV),
        [0, 0]
      );
    }
    this.writer.triangle(first, first + 1, first + 2);
    this.writer.triangle(first, first + 2, first + 3);
  }

  /** The one degenerate triangle a mesh with no indices gets, to suppress the engine's error (`:3581-3592`). */
  writeDegenerateTriangle(): void {
    this.writer.vertex([0, 0, 0], [0, 0, 0], FRONT_TANGENT, [0, 0], [0, 0]);
    this.writer.triangle(0, 0, 0);
  }

  get isEmpty(): boolean {
    return this.writer.vertexCount === 0;
  }

  surface(): GodotSurface {
    return this.writer.surface();
  }
}

/** An empty `language` shapes in `locale`, the project's `_get_locale()`. */
export function buildTextMeshSurface(
  properties: TextMeshProperties,
  locale: string,
  chain: TextMeshChain
): GodotSurface {
  const [face, ...fallbacks] = chain;
  const lines = shapeTextMeshLines(properties, locale, withFallbacks(face, fallbacks));
  const placed = placeGlyphs(properties, lines, glyphMeshesByFace(properties, face, fallbacks));
  const writer = new TextMeshWriter(properties.depth, inkBounds(placed));
  for (const glyph of placed) {
    if (isOutline(glyph)) writer.writeGlyph(glyph);
    else writer.writeBox(glyph);
  }
  if (writer.isEmpty) writer.writeDegenerateTriangle();
  return writer.surface();
}
