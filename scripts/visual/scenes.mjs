/**
 * Golden-scene manifest for the visual-regression harness.
 *
 * v1 policy: untextured, WebGL-canvas-rendered scenes only — no external
 * texture loads and no 2D DOM overlays, so the captured image depends on
 * nothing but the renderer. `file` is the bare fixture filename exactly as
 * it appears in apps/textscene-web/src/fixtures.ts (the `?fixture=` deep
 * link). `maxDiffPct` overrides the default failure threshold for scenes
 * with antialiasing-sensitive content (thin gizmo lines).
 */

export const DEFAULT_MAX_DIFF_PCT = 0.1;

export const GOLDEN_SCENES = [
  { name: 'plane-mesh', file: 'unit-plane-mesh.tscn' },
  // The ShortWall regression scene: rotated+scaled plane whose transform
  // decomposition history is pinned by transform.regression.test.ts — this
  // baseline pins what it LOOKS like.
  { name: 'plane-rotated-scaled', file: 'edge-plane-rotated-scaled.tscn' },
  { name: 'all-meshes', file: 'integration-all-meshes.tscn' },
  { name: 'all-primitives', file: 'integration-all-primitives.tscn' },
  // External ArrayMesh .tres: decoded quad with Godot's packed normals. Loads
  // a local resource (deterministic), gated by the two-identical-frames settle.
  { name: 'arraymesh', file: 'unit-arraymesh.tscn' },
  { name: 'grid-map', file: 'unit-grid-map.tscn' },
  { name: 'navigation-region-3d', file: 'unit-navigation-region-3d.tscn' },
  { name: 'material-metallic', file: 'unit-material-metallic.tscn' },
  { name: 'material-emissive', file: 'unit-material-emissive.tscn' },
  { name: 'world-environment', file: 'unit-world-environment-basic.tscn' },
  // NOTE: unit-label3d.tscn is deliberately NOT in the set — Label3D
  // labels render effectively invisible after auto-framing (default
  // pixel_size 0.005 → ~0.08 world units tall; the committed showcase
  // poster docs/showcase/web/label3d.png is equally blank). Re-add once
  // that sizing issue is addressed.
  { name: 'mixed-nodes', file: 'integration-mixed-nodes.tscn' },
  { name: 'hallway-mockup', file: 'example-hallway-mockup.tscn' },
  // Thin collision-gizmo lines are the most AA-sensitive content in the set.
  { name: 'physics-bodies', file: 'unit-physics-bodies.tscn', maxDiffPct: 0.3 },
];
