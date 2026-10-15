/** The alignment the box, flow and aspect ratio containers share. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/**
 * `AlignmentMode`, declared alike by `BoxContainer` (`scene/gui/box_container.h:39-43`),
 * `FlowContainer` (`flow_container.h:39-43`) and `AspectRatioContainer` (`aspect_ratio_container.h:50-54`).
 */
export enum ContainerAlignment {
  ALIGNMENT_BEGIN = 0,
  ALIGNMENT_CENTER = 1,
  ALIGNMENT_END = 2,
}

export const CONTAINER_ALIGNMENT_NAMES = enumNamesByValue(ContainerAlignment);
