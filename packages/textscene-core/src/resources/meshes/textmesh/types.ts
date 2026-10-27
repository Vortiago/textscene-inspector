import type { Vector2 } from '../../../godot/math/vector';
import type { HorizontalAlignment, VerticalAlignment } from '../../../godot/math/alignment';
import type { EnumValue } from '../../../godot/classdb/enumNames';

/** What a TextMesh's build reads of its own properties, each as the setter leaves it. */
export interface TextMeshProperties {
  text: string;
  fontSize: number;
  horizontalAlignment: EnumValue<typeof HorizontalAlignment>;
  verticalAlignment: EnumValue<typeof VerticalAlignment>;
  isUppercase: boolean;
  lineSpacing: number;
  /** An `AutowrapMode`, or an integer outside the enum, which shapes as `AUTOWRAP_OFF` as Godot's switch does. */
  autowrapMode: number;
  justificationFlags: number;
  depth: number;
  /** In px. */
  width: number;
  pixelSize: number;
  curveStep: number;
  offset: Vector2;
}
