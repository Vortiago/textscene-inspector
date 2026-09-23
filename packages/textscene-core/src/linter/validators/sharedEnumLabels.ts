/**
 * Label tables that unrelated Godot classes bind identically, with no common
 * ancestor to hoist onto. A table is data, not a bound: each `v.enumInt` call
 * site keeps its own `file:line` citation (ADR-0032). One-family tables live in
 * `containerAlignment.ts` and `textServerEnums.ts`.
 */

/**
 * `Area2D.SpaceOverride` and `Area3D.SpaceOverride`, enforced separately by
 * each class: `area_2d.cpp:653` and `area_3d.cpp:778`.
 */
export const SPACE_OVERRIDE = {
  0: 'DISABLED',
  1: 'COMBINE',
  2: 'COMBINE_REPLACE',
  3: 'REPLACE',
  4: 'REPLACE_COMBINE',
} as const;

/**
 * `TextureButton.StretchMode` and `TextureRect.StretchMode` (`texture_button.h:39-47`,
 * `texture_rect.h:48-56`). Neither setter enforces the range, so both bounds
 * are hinted, each citing its own `ADD_PROPERTY`.
 */
export const TEXTURE_STRETCH_MODE = {
  0: 'STRETCH_SCALE',
  1: 'STRETCH_TILE',
  2: 'STRETCH_KEEP',
  3: 'STRETCH_KEEP_CENTERED',
  4: 'STRETCH_KEEP_ASPECT',
  5: 'STRETCH_KEEP_ASPECT_CENTERED',
  6: 'STRETCH_KEEP_ASPECT_COVERED',
} as const;

/**
 * `PopupMenu`'s per-item checkable type, reached by `MenuButton` too, which
 * forwards its item writes to PopupMenu's own setter (`popup_menu.cpp:62-73`).
 */
export const ITEM_CHECKABLE_TYPE = {
  0: 'NONE',
  1: 'CHECK_BOX',
  2: 'RADIO_BUTTON',
} as const;

/**
 * `Vector3::Axis` declaration order (vector3.h:57-61), a core enum with no
 * node slice to hoist onto. Annotated, not `as const`: a runtime axis number
 * indexes it to label a diagnostic, and `as const` keys refuse a `number`.
 */
export const VECTOR3_AXIS: Readonly<Record<number, string>> = {
  0: 'X',
  1: 'Y',
  2: 'Z',
};

/**
 * `VisibleOnScreenEnabler2D::EnableMode` and `VisibleOnScreenEnabler3D::EnableMode`,
 * two C++ enums with identical constants (`visible_on_screen_notifier_2d.h:85-89`,
 * `visible_on_screen_notifier_3d.h:65-69`) in the hint order "Inherit,Always,When Paused".
 * Each setter bare-assigns.
 */
export const ENABLE_MODE = {
  0: 'ENABLE_MODE_INHERIT',
  1: 'ENABLE_MODE_ALWAYS',
  2: 'ENABLE_MODE_WHEN_PAUSED',
} as const;

/**
 * `AudioServer::PlaybackType` (`audio_server.h:194-199`), one core enum: all
 * three AudioStreamPlayers forward to `AudioStreamPlayerInternal::set_playback_type`
 * (audio_stream_player_internal.cpp:337-339), and no common ancestor declares it.
 */
export const PLAYBACK_TYPE = {
  0: 'DEFAULT',
  1: 'STREAM',
  2: 'SAMPLE',
} as const;

/**
 * `BaseMaterial3D::AlphaAntiAliasing` (scene/resources/material.h:196-200), which
 * `Label3D` and `SpriteBase3D` both re-bind and forward to their own
 * StandardMaterial3D. `GeometryInstance3D`, their common ancestor, lacks it.
 */
export const BASE_MATERIAL_ALPHA_ANTIALIASING = {
  0: 'OFF',
  1: 'ALPHA_TO_COVERAGE',
  2: 'ALPHA_TO_COVERAGE_AND_TO_ONE',
} as const;

/**
 * The alpha-cut mode `Label3D` and `SpriteBase3D` each declare, two enums that
 * agree (`label_3d.h:50-56`, `sprite_3d.h:52-58`); `material.h` has no `AlphaCutMode`.
 * Both setters enforce `ERR_FAIL_INDEX(p_mode, ALPHA_CUT_MAX)` at
 * `label_3d.cpp:1013` and `sprite_3d.cpp:531`.
 */
export const LABEL_SPRITE_ALPHA_CUT = {
  0: 'DISABLED',
  1: 'DISCARD',
  2: 'OPAQUE_PREPASS',
  3: 'HASH',
} as const;

/**
 * `BaseMaterial3D::TextureFilter` (scene/resources/material.h:171-178), not
 * `TEXTURE_FILTER`: `CanvasItem::TextureFilter` (canvasitem/shared) prepends
 * `PARENT_NODE` at 0, and `Viewport::DefaultCanvasItemTextureFilter`
 * (viewport/shared) has four, with the two `_WITH_MIPMAPS` values swapped.
 */
export const BASE_MATERIAL_TEXTURE_FILTER = {
  0: 'NEAREST',
  1: 'LINEAR',
  2: 'NEAREST_WITH_MIPMAPS',
  3: 'LINEAR_WITH_MIPMAPS',
  4: 'NEAREST_WITH_MIPMAPS_ANISOTROPIC',
  5: 'LINEAR_WITH_MIPMAPS_ANISOTROPIC',
} as const;
