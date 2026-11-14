/**
 * The `SolveNode` and `TscnNode` fields a test does not care about, so a required
 * field is one edit here and a literal that omits it fails to compile:
 *
 *     const n: SolveNode = { ...solveNode(), path: 'L', node: controlNode('L', 'Label') };
 */

import type { TscnNode } from '../../../../parser/types';
import type { ControlProperties } from '../../../../nodes/2d/ui/control/types';
import { NO_PROJECT_FONTS, type ProjectFonts } from '../../../../resources/fonts/font/projectFonts';
import { defaultThemeAt } from '../../../../godot/scene/defaultTheme/defaultTheme';
import type { SolveNode } from '../solveTree';
import { canvasItemFieldsOf } from '../../../canvasItemPass/canvasItemFields';
import {
  CHAIN_START_INHERITANCE,
  type CanvasInheritance,
} from '../../../canvasItemPass/inheritedCanvasState';
import { mergeThemedRecord, themeResolutionScope } from '../../../../resources/styles/theme/lookup';
import { defaultColorsOf, defaultConstantsOf, defaultStyleBoxesOf } from '../defaultThemeRecords';
import { allocateNodePaintRange } from '../../../testing/detachedPaint';
import {
  behindRangesOf,
  allocatePaintRange,
  WHOLE_CANVAS_RANGE,
  type PaintRange,
} from '../../../canvasPaintOrder';
import { WHOLE_CANVAS_PAINT } from '../../../canvasItemPass/canvasItemPaint';

/**
 * Frozen because every node this factory builds shares them, and `readonly` is
 * erased at runtime: a mutation throws where it happens instead of leaking into
 * every other node in the run.
 */
const NO_STYLE_BOXES: SolveNode['styleBoxes'] = Object.freeze({});
const NO_TEXTURE_SLOTS: SolveNode['textureSlots'] = Object.freeze({});
const NO_FONT_OVERRIDES: SolveNode['fontOverrides'] = Object.freeze({});
const NO_THEME_CHAIN: SolveNode['themeChain'] = Object.freeze([]);
const NO_COLORS: SolveNode['colors'] = Object.freeze({});
const NO_CONSTANTS: SolveNode['constants'] = Object.freeze({});
const NO_ICONS: SolveNode['icons'] = Object.freeze({});
const NO_RESOURCES: SolveNode['resources'] = Object.freeze({
  externalResources: Object.freeze([]),
  internalResources: Object.freeze([]),
});

/** A root of the walk's tree, which hangs below the drawn item the walk sits in. */
const WALK_ROOT: CanvasInheritance = { links: [], startsChain: false };

/**
 * Every field but `path` and `node`, which have no meaningful default. Spread
 * this into a literal, then supply both.
 */
export function solveNode(): Pick<
  SolveNode,
  | 'children'
  | 'styleBoxes'
  | 'textureSize'
  | 'textureSlots'
  | 'hidden'
  | 'parentVisibleInTree'
  | 'fontOverrides'
  | 'labelSettings'
  | 'labelSettingsFont'
  | 'themeChain'
  | 'projectFonts'
  | 'colors'
  | 'constants'
  | 'icons'
  | 'resources'
  | 'paint'
  | 'skippedTransform'
  | 'inheritance'
  | 'rtl'
  | 'locale'
> {
  return {
    children: [],
    styleBoxes: NO_STYLE_BOXES,
    textureSize: null,
    textureSlots: NO_TEXTURE_SLOTS,
    hidden: false,
    // Nothing above hides it: `CanvasItem::parent_visible_in_tree` for a scene
    // root, and what every visible ancestor passes down.
    parentVisibleInTree: true,
    fontOverrides: NO_FONT_OVERRIDES,
    labelSettings: null,
    labelSettingsFont: null,
    themeChain: NO_THEME_CHAIN,
    projectFonts: NO_PROJECT_FONTS,
    colors: NO_COLORS,
    constants: NO_CONSTANTS,
    icons: NO_ICONS,
    resources: NO_RESOURCES,
    // The whole canvas, which a lone Control owns. These defaults tie rather than
    // invent an order. A test asserting draw order uses `withPaintRanges`.
    paint: WHOLE_CANVAS_PAINT,
    // No skipped Node2D ancestor, the common case a hand-built tree states.
    skippedTransform: null,
    inheritance: WALK_ROOT,
    // `LAYOUT_DIRECTION_INHERITED` all the way to a left-to-right root.
    rtl: false,
    // No `internationalization/locale/test`.
    locale: '',
  };
}

/**
 * `n` with the items the default theme gives its type and `theme_type_variation`, under the items `n`
 * already holds, which stand in for its overrides and scene Themes. The tree build gives every node
 * these, so a painter or solver reads them with no fallback.
 */
export function withThemeItems<T extends SolveNode>(n: T): T {
  const variation = (n.node.properties as ControlProperties).themeTypeVariation;
  const scope = themeResolutionScope(n.node.type, variation, n.themeChain, n.projectFonts);
  const noSceneItems = () => undefined;
  return {
    ...n,
    styleBoxes: mergeThemedRecord(scope, n.styleBoxes, noSceneItems, defaultStyleBoxesOf),
    colors: mergeThemedRecord(scope, n.colors, noSceneItems, defaultColorsOf),
    constants: mergeThemedRecord(scope, n.constants, noSceneItems, defaultConstantsOf),
  };
}

/** No project Theme or font, under the default theme at `scale`, as `gui/theme/default_theme_scale` sets it. */
export function projectFontsAt(scale: number): ProjectFonts {
  return { ...NO_PROJECT_FONTS, defaultTheme: defaultThemeAt(scale) };
}

/**
 * A childless `TscnNode` with no raw properties. `properties` is the caller's
 * object, not a copy, so a test can assert identity on it, and a test that wants
 * `name` among them passes it.
 */
export function controlNode(name: string, type: string, properties: object = {}): TscnNode {
  return {
    name,
    type,
    children: [],
    properties: properties as ControlProperties,
    rawProperties: {},
  };
}

/**
 * Assigns each node in a hand-built `SolveNode` tree the draw-sequence run
 * `buildSolveTree` would, so a test can assert paint order. Production allocates
 * over every live sibling. A hand-built tree has only its Controls.
 */
export function withPaintRanges(
  roots: readonly SolveNode[],
  range: PaintRange = WHOLE_CANVAS_RANGE
): SolveNode[] {
  // The production allocator, as `buildSolveTree` and `NodeDispatcher` use for the
  // root list, so tests see the sequences the renderer emits.
  const allocated = allocatePaintRange(range, roots.map(shadowTree));
  return roots.map((root, i) => assignRange(root, allocated.children[i]!));
}

/**
 * A hand-built `SolveNode` carries its children on itself and leaves
 * `node.children` empty, so the allocator would size every subtree at 1. This
 * rebuilds the `TscnNode` tree the allocator reads.
 */
function shadowTree(n: SolveNode): TscnNode {
  return { ...n.node, children: n.children.map(shadowTree) };
}

/** Splits `own` between a node and its children through the production allocator. */
function assignRange(node: SolveNode, own: PaintRange): SolveNode {
  const shadow = shadowTree(node);
  const allocated = allocateNodePaintRange(own, shadow);
  return {
    ...node,
    paint: {
      range: own,
      own: allocated.self,
      front: allocated.front,
      layer: allocated.layer,
      back: allocated.back,
      tail: allocated.tail,
      behind: behindRangesOf(shadow.children, allocated.children),
    },
    children: node.children.map((child, i) => assignRange(child, allocated.children[i]!)),
  };
}

/**
 * `node` and its subtree with the inheritance the solve gives them: each Control's links run from
 * the walk's root down, and a CanvasLayer's children start a chain.
 */
export function linkedTree(node: SolveNode, inheritance: CanvasInheritance = WALK_ROOT): SolveNode {
  const fields = canvasItemFieldsOf(node.node);
  const below = fields
    ? {
        ...inheritance,
        links: [...inheritance.links, { fields, resources: node.resources, path: node.path }],
      }
    : CHAIN_START_INHERITANCE;
  return { ...node, inheritance, children: node.children.map((child) => linkedTree(child, below)) };
}
