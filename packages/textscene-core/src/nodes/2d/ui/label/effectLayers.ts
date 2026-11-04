/**
 * The outline and shadow layers one Label line draws behind its fill, in Godot's order
 * (`label.cpp:828-874`). Pure: the painter in `Component.tsx` draws the list.
 */
import type { Rgba } from '../../../../godot/math/math';
import type { Vector2 } from '../../../../godot/math/vector';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { LabelSettingsResource } from '../../../../resources/styles/labelsettings/types';
import { labelOutlineTheme, labelShadowTheme } from './nativeSolver';

export interface LabelEffectLayer {
  /** A `ring` strokes the glyph contour. A `plain` layer draws the glyphs in `color`. */
  kind: 'ring' | 'plain';
  /** Before the Label's modulate. */
  color: Rgba;
  /** Where the layer sits against the fill, px. */
  offset: Vector2;
  /** `outline_size` of a ring, px. 0 for a plain layer. */
  ringSizePx: number;
}

const NO_OFFSET: Vector2 = { x: 0, y: 0 };

function ring(color: Rgba, ringSizePx: number, offset: Vector2 = NO_OFFSET): LabelEffectLayer {
  return { kind: 'ring', color, offset, ringSizePx };
}

function plain(color: Rgba, offset: Vector2): LabelEffectLayer {
  return { kind: 'plain', color, offset, ringSizePx: 0 };
}

/** The fill: the last layer, in the Label's own colour at no offset. */
export function labelFillLayer(color: Rgba): LabelEffectLayer {
  return plain(color, NO_OFFSET);
}

/** `label.cpp:829-836`: the shadow ring needs a non-zero alpha, the shadow itself a positive one. */
function baseShadowLayers(n: SolveNode): LabelEffectLayer[] {
  const { size, color, offset } = labelShadowTheme(n);
  const layers: LabelEffectLayer[] = [];
  if (color.a !== 0 && size > 0) layers.push(ring(color, size, offset));
  if (color.a > 0) layers.push(plain(color, offset));
  return layers;
}

/** `label.cpp:839-850`: the last index draws first, each with its ring under it. */
function stackedShadowLayers(settings: LabelSettingsResource): LabelEffectLayer[] {
  return [...settings.stackedShadows]
    .reverse()
    .flatMap(({ offset, color, outlineSize }) => [
      ...(outlineSize > 0 ? [ring(color, outlineSize, offset)] : []),
      plain(color, offset),
    ]);
}

/**
 * `label.cpp:853-874`: the biggest ring draws first, at the outline size plus every positive stacked
 * size. Each ring that draws takes its own size off the next one's.
 */
function stackedOutlineLayers(settings: LabelSettingsResource): LabelEffectLayer[] {
  const drawn = settings.stackedOutlines.filter(({ size }) => size > 0).reverse();
  let sizePx = drawn.reduce((total, { size }) => total + size, settings.outlineSize);
  return drawn.map(({ size, color }) => {
    const layer = ring(color, sizePx);
    sizePx -= size;
    return layer;
  });
}

/** `label.cpp:877-879`. */
function baseOutlineLayers(n: SolveNode): LabelEffectLayer[] {
  const { size, color } = labelOutlineTheme(n);
  return size > 0 && color.a !== 0 ? [ring(color, size)] : [];
}

/**
 * The layers behind one line's fill, first drawn first. A Label with `label_settings` adds the
 * stacked shadows and outlines. The fill draws after the last layer.
 */
export function labelEffectLayers(n: SolveNode): LabelEffectLayer[] {
  const settings = n.labelSettings;
  return [
    ...baseShadowLayers(n),
    ...(settings ? stackedShadowLayers(settings) : []),
    ...(settings ? stackedOutlineLayers(settings) : []),
    ...baseOutlineLayers(n),
  ];
}
