import type { ControlProperties } from '../control/types';

export interface TextureButtonProperties extends ControlProperties {
  /** Texture2D reference (raw, unresolved) drawn in the normal draw state. */
  textureNormal?: string;
  /** Texture2D reference drawn while pressed (falls back to hover, then normal). */
  texturePressed?: string;
  /** Texture2D reference for hover, which a pointer-less preview never selects. It still draws as a fallback for `texture_pressed`. */
  textureHover?: string;
  /** Texture2D reference drawn while disabled (falls back to normal). */
  textureDisabled?: string;
  /** Texture2D reference for focus, never drawn: a static preview never holds keyboard focus. */
  textureFocused?: string;
  /** Whether the button's own size ignores every texture's natural size (default false). */
  ignoreTextureSize?: boolean;
  /** StretchMode, 0=SCALE .. 6=KEEP_ASPECT_COVERED. Godot default 2 (KEEP). */
  stretchMode?: number;
  flipH?: boolean;
  flipV?: boolean;
  /** BaseButton's disabled flag: TextureButton derives from BaseButton, not Button. */
  disabled?: boolean;
  /** BaseButton's own button_pressed flag. */
  buttonPressed?: boolean;
}
