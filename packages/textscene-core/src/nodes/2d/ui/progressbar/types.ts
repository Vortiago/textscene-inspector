import type { ControlProperties } from '../control/types';
import type { RangeProperties } from '../shared/range';

/** `ProgressBar`'s own four members (`doc/classes/ProgressBar.xml`), plus its Control + Range bases. */
export interface ProgressBarProperties extends ControlProperties, RangeProperties {
  /** `FillMode`: 0 begin-to-end, 1 end-to-begin, 2 top-to-bottom, 3 bottom-to-top. */
  fillMode?: number;
  /** Draw the centred percentage string. Godot default true. */
  showPercentage?: boolean;
  /** Draw the animated indeterminate bar instead of a ratio fill. Godot default false. */
  indeterminate?: boolean;
  /** Preview the indeterminate animation inside the editor. Godot default false; irrelevant at runtime. */
  editorPreviewIndeterminate?: boolean;
}
