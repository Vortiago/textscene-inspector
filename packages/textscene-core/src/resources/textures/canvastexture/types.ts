/**
 * CanvasTexture slice types: a canvas item's diffuse, normal and specular maps and the sampler they
 * share (`scene/main/canvas_item.h:428-480`). No THREE.
 */

import type { Rgba } from '../../../godot/math/math.js';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';
import type { CanvasItemTextureFilter, CanvasItemTextureRepeat } from '../../../godot/scene/canvasItem.js';

/** The `type` a CanvasTexture sub-resource declares. */
export const CANVAS_TEXTURE_TYPE = 'CanvasTexture';

/**
 * Typed view of a `CanvasTexture` block. The texture references stay raw: resolving one needs the
 * owning file's resource tables, which a leaf module does not take.
 */
export interface CanvasTextureData {
  diffuseTexture: string | null;
  /** Read raw, without the sRGB decode (`texture_storage.cpp:766`). */
  normalTexture: string | null;
  specularTexture: string | null;
  /** Only its rgb reaches the renderer: the shininess takes the alpha (`texture_storage.cpp:693-696`). */
  specularColor: Rgba;
  specularShininess: number;
  /** PARENT_NODE takes the drawing item's filter (`texture_storage.cpp:737`). */
  textureFilter: EnumValue<typeof CanvasItemTextureFilter>;
  textureRepeat: EnumValue<typeof CanvasItemTextureRepeat>;
}
