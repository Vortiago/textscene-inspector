import type { ControlProperties } from '../control/types';

export interface AspectRatioContainerProperties extends ControlProperties {
  /** `aspect_ratio_container.h:57`, default `1.0`. */
  ratio?: number;
  /** `AspectRatioContainer::StretchMode` (`aspect_ratio_container.h:44-49`), default `STRETCH_FIT` (2). */
  stretchMode?: number;
  /** `AspectRatioContainer::AlignmentMode`, horizontal axis (`aspect_ratio_container.h:50-54,59`), default `ALIGNMENT_CENTER` (1). */
  alignmentHorizontal?: number;
  /** Same enum, vertical axis (`aspect_ratio_container.h:60`), default `ALIGNMENT_CENTER` (1). */
  alignmentVertical?: number;
}
