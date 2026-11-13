# A CPU shadow map covers bins by the reference driver's fill rule

- Status: Accepted
- Related: ADR-0030 (the 2D shadow penumbra), ADR-0066 (every shadowed PointLight2D samples the
  polar map), #1470.

## Context

Godot rasterises each occluder edge into a light's one-row shadow map as a quad extruded far past
the row (`renderer_canvas_render_rd.cpp:1343-1368`). The edge's two ends become the quad's vertical
sides, so a bin is covered when its pixel centre lies between them. The previewer builds the same
map on the CPU (ADR-0030) and decided coverage by a ray test at the bin centre.

An end can land exactly on a bin centre. At `shadow_atlas/size` 1000 an end of the
`shadow-atlas-size` fixture lands at window x 37.5 of a 250-column frustum. The ray test then
covered or left the bin by float rounding, and the whole penumbra on that side moved by one bin:
about 6,500 pixels up to 11/255 off Godot.

## Decision

Both CPU builders, `shadowPolarMap.ts` and `directionalShadowMap.ts`, take the covered bins from
`coveredPixelRange` (`utils/coveredPixelRange.ts`). It snaps each end to 1/256 of a pixel, as
lavapipe does, and covers the bin centres in `[left, right)`, the top-left rule. Lavapipe is the
driver every Godot comparison renders on, so its rule is the reference. A bin that the snap adds past
an end reads that end's depth, as the rasteriser interpolates between the snapped ends.

## Considered Options

- **Keep the ray test with a tolerance.** Rejected. A tolerance picks a side by a number with no
  source, and it still disagrees with the rasteriser on one of the two sides.
- **Rasterise the map on the GPU.** Rejected for the reason ADR-0030 gives: the goldens would carry
  the browser driver's fill rule instead of the reference driver's.

## Consequences

- An end on a bin centre matches Godot at every atlas size. `unit-pointlight2d-shadow-end-on-bin`
  shows it at the 2048 default.
- A GPU with another subpixel precision rasterises an end within 1/512 px of a centre by its own
  rule. The reference renders on lavapipe, so the previewer follows it.
