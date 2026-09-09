/**
 * Golden-scene manifest for the visual-regression harness.
 *
 * Policy: WebGL-canvas-rendered scenes only — no 2D DOM overlays, so the
 * captured image depends on nothing but the renderer. Resource/texture loads
 * are allowed only when they resolve from local fixtures and settle
 * deterministically (the two-identical-frames gate rejects anything that
 * doesn't), e.g. `arraymesh` (.tres geometry) and `decal` (a local SVG
 * texture). `file` is the bare fixture filename exactly as it appears in
 * apps/textscene-web/src/fixtures.ts (the `?fixture=` deep link). `maxDiffPct`
 * overrides the default failure threshold for scenes with antialiasing-
 * sensitive content (thin gizmo lines).
 *
 * `collisions: true` (optional) ticks the toolbar's "Visible Collision Shapes"
 * checkbox before capturing, so CollisionShape2D/3D gizmos render — they are
 * off by default (ADR-0005/0006) and therefore invisible to every other scene.
 *
 * `select` (optional) is a node path the harness selects in the scene tree
 * before capturing, so a selection-gated gizmo (Marker/Path/PathFollow, ADR-0018)
 * renders. These `*-selected` scenes are the real-browser regression guard for
 * the gizmos — the un-selected fixtures never show them. Their thin AA lines and
 * the selection-highlight box make them AA-sensitive, hence the relaxed
 * `maxDiffPct`.
 *
 * The entries live in `scenes/`, one file per chapter of the list, and are
 * concatenated here in that order — the harness runs them in manifest order, so
 * the concatenation below is the manifest.
 */

import { GEOMETRY_SCENES } from './scenes/geometry.mjs';
import { LIGHTING_SCENES } from './scenes/lighting.mjs';
import { SCENE_COMPOSITION_SCENES } from './scenes/composition.mjs';
import { GIZMO_SCENES } from './scenes/gizmos.mjs';
import { PRIMITIVE_SCENES } from './scenes/primitives.mjs';
import { CANVAS_2D_SCENES } from './scenes/canvas2d.mjs';
import { MATERIAL_SCENES } from './scenes/materials.mjs';
import { TILE_AND_TARGET_SCENES } from './scenes/targets.mjs';

export const DEFAULT_MAX_DIFF_PCT = 0.1;

/**
 * Deliberately ABSENT from the set, each for a reason that would otherwise be
 * rediscovered as a suspected gap:
 *
 * - NOTE: unit-label3d.tscn is deliberately NOT in the set — Label3D
 *   labels render effectively invisible after auto-framing (default
 *   pixel_size 0.005 → ~0.08 world units tall; the committed showcase
 *   poster docs/showcase/web/label3d.png is equally blank). Re-add once
 *   that sizing issue is addressed.
 * - NOTE: unit-animation-player*.tscn are deliberately NOT in the set —
 *   AnimationPlayer playback is non-deterministic over time and never reaches
 *   a byte-stable state once playing. The default (stopped) render shows the
 *   authored pose, but the fixtures exist to be played, so they stay out of
 *   the stability-gated visual set (same rationale as Label3D above).
 * - NOTE: AreaLight3D deliberately has no golden — its fixture is light-only
 *   (no lit geometry), so the frame is blank. Add one once the fixture gains a
 *   lit surface to show the emitter's effect.
 */
export const GOLDEN_SCENES = [
  ...GEOMETRY_SCENES,
  ...LIGHTING_SCENES,
  ...SCENE_COMPOSITION_SCENES,
  ...GIZMO_SCENES,
  ...PRIMITIVE_SCENES,
  ...CANVAS_2D_SCENES,
  ...MATERIAL_SCENES,
  ...TILE_AND_TARGET_SCENES,
];
