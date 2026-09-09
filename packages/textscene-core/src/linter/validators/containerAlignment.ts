/**
 * Godot's `BoxContainer.AlignmentMode`, shared verbatim by `FlowContainer`.
 *
 * Both bind the same three constants (`scene/gui/box_container.cpp` and
 * `scene/gui/flow_container.cpp`, `BIND_ENUM_CONSTANT ALIGNMENT_BEGIN=0,
 * ALIGNMENT_CENTER=1, ALIGNMENT_END=2`), and both spell them into an
 * `alignment` enum validator. Fifteen more containers land in later waves, most
 * carrying the same key — the same argument `themeOverrides.ts` makes for the
 * theme family.
 */

export const CONTAINER_ALIGNMENT = {
  0: 'ALIGNMENT_BEGIN',
  1: 'ALIGNMENT_CENTER',
  2: 'ALIGNMENT_END',
} as const;
