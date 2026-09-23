/**
 * Godot's `BoxContainer.AlignmentMode`, shared verbatim by `FlowContainer`:
 * both bind `ALIGNMENT_BEGIN=0, ALIGNMENT_CENTER=1, ALIGNMENT_END=2`
 * (`scene/gui/box_container.cpp`, `scene/gui/flow_container.cpp`) for their
 * `alignment` enum validator.
 */

export const CONTAINER_ALIGNMENT = {
  0: 'ALIGNMENT_BEGIN',
  1: 'ALIGNMENT_CENTER',
  2: 'ALIGNMENT_END',
} as const;
