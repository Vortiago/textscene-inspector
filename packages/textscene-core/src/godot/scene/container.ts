/** The alignment the box, flow and aspect ratio containers share. */

/**
 * `AlignmentMode`, declared alike by `BoxContainer` (`scene/gui/box_container.h:39-43`),
 * `FlowContainer` (`flow_container.h:39-43`) and `AspectRatioContainer` (`aspect_ratio_container.h:50-54`).
 */
export const CONTAINER_ALIGNMENT = {
  0: 'ALIGNMENT_BEGIN',
  1: 'ALIGNMENT_CENTER',
  2: 'ALIGNMENT_END',
} as const;
