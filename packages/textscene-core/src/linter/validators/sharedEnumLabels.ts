/**
 * Label tables two unrelated Godot classes bind identically.
 *
 * A table here is DATA, not a bound. The citation stays at each `v.enumInt` call
 * site, because two classes binding the same constants still enforce them at
 * their own `file:line` and ADR-0032 wants that line beside the bound. What
 * moves here is only the names, which are the part that is genuinely the same.
 *
 * The bar for admission is a table byte-identical in two or more slices with no
 * common ancestor to hoist onto. `containerAlignment.ts` and `textServerEnums.ts`
 * are the same idea, kept separate because those belong to one family each;
 * these are cross-family coincidences.
 */

/**
 * `Area2D.SpaceOverride` and `Area3D.SpaceOverride`.
 *
 * Enforced separately by each class: `area_2d.cpp:653` and `area_3d.cpp:778`.
 * This table used to live in a shared `physicsValidators.ts`; when that file was
 * deleted the validator-building was correctly inlined into both slices, but the
 * label data got copied rather than re-homed.
 */
export const SPACE_OVERRIDE = {
  0: 'DISABLED',
  1: 'COMBINE',
  2: 'COMBINE_REPLACE',
  3: 'REPLACE',
  4: 'REPLACE_COMBINE',
} as const;

/**
 * `TextureButton.StretchMode` and `TextureRect.StretchMode`.
 *
 * Two classes that happen to bind the identical seven constants
 * (`texture_button.h:39-47`, `texture_rect.h:48-56`). Neither setter enforces
 * the range, so both bounds are hinted, each citing its own `ADD_PROPERTY`.
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
 * `PopupMenu`'s per-item checkable type, reached by `MenuButton` too.
 *
 * MenuButton forwards its item writes to PopupMenu's own setter
 * (`popup_menu.cpp:62-73`), so both slices check the same values against the same
 * guard, and there is no shared ancestor between a Popup and a Button to hoist
 * the table onto.
 */
export const ITEM_CHECKABLE_TYPE = {
  0: 'NONE',
  1: 'CHECK_BOX',
  2: 'RADIO_BUTTON',
} as const;

/**
 * `Vector3::Axis` declaration order (vector3.h:57-61).
 *
 * Core's enum, not any node's, so it has no ancestor slice to hoist onto even
 * though its three consumers here (`AimModifier3D`, `LookAtModifier3D`,
 * `ConvertTransformModifier3D`) share one. Each still enforces at its own
 * `ADD_PROPERTY` hint, and the citation stays at the call site.
 *
 * Annotated rather than `as const` like its neighbours above: those are only
 * ever passed whole to `v.enumInt`, while this one is also indexed by a runtime
 * axis number to label a diagnostic, and `as const` narrows the keys to literals
 * that a `number` cannot index.
 */
export const VECTOR3_AXIS: Readonly<Record<number, string>> = {
  0: 'X',
  1: 'Y',
  2: 'Z',
};

/**
 * `VisibleOnScreenEnabler2D::EnableMode` and `VisibleOnScreenEnabler3D::EnableMode`.
 *
 * Two separate C++ enums that happen to bind the identical three constants
 * (`visible_on_screen_notifier_2d.h:85-89`, `visible_on_screen_notifier_3d.h:65-69`),
 * in the order of the shared hint string "Inherit,Always,When Paused". The two
 * classes share no ancestor that owns the property — one descends from Node2D,
 * the other from Node3D — so there is no slice to hoist onto. Each setter
 * bare-assigns and each `v.enumInt` keeps its own citation.
 */
export const ENABLE_MODE = {
  0: 'ENABLE_MODE_INHERIT',
  1: 'ENABLE_MODE_ALWAYS',
  2: 'ENABLE_MODE_WHEN_PAUSED',
} as const;

/**
 * `AudioServer::PlaybackType`, reached by all three AudioStreamPlayers.
 *
 * Not a coincidence like its neighbours above but one core enum
 * (`audio_server.h:74-80`): each player's setter forwards to the same
 * `AudioStreamPlayerInternal::set_playback_type`
 * (audio_stream_player_internal.cpp:337-339). They still have nowhere to hoist
 * it — the three descend from `Node`, `Node2D` and `Node3D`, and no ancestor
 * declares the property — so the labels live here and each `v.enumInt` keeps
 * its own `ADD_PROPERTY` citation.
 */
export const PLAYBACK_TYPE = {
  0: 'DEFAULT',
  1: 'STREAM',
  2: 'SAMPLE',
} as const;

/**
 * Three `BaseMaterial3D` enums that `Label3D` and `SpriteBase3D` both re-bind.
 *
 * Each class builds its own StandardMaterial3D and forwards the value, so both
 * declare the property itself and neither inherits it: `GeometryInstance3D`,
 * their nearest common ancestor, knows nothing about any of the three.
 *
 * `BASE_MATERIAL_TEXTURE_FILTER` is spelled out rather than named
 * `TEXTURE_FILTER` because THREE different engine enums carry that name and two
 * are still local to their slices on purpose: `CanvasItem::TextureFilter`
 * (canvasitem/shared) prepends `PARENT_NODE` at 0 and so runs seven values
 * offset by one, and `Viewport::DefaultCanvasItemTextureFilter`
 * (viewport/shared) has four with `LINEAR_WITH_MIPMAPS` and
 * `NEAREST_WITH_MIPMAPS` in the opposite order. Sharing on the name alone would
 * mislabel every diagnostic those two raise.
 */
export const BASE_MATERIAL_ALPHA_ANTIALIASING = {
  0: 'OFF',
  1: 'ALPHA_TO_COVERAGE',
  2: 'ALPHA_TO_COVERAGE_AND_TO_ONE',
} as const;

/** `BaseMaterial3D::AlphaCutMode`, as Label3D and SpriteBase3D both bind it. */
export const BASE_MATERIAL_ALPHA_CUT = {
  0: 'DISABLED',
  1: 'DISCARD',
  2: 'OPAQUE_PREPASS',
  3: 'HASH',
} as const;

/** `BaseMaterial3D::TextureFilter` — see the naming note above. */
export const BASE_MATERIAL_TEXTURE_FILTER = {
  0: 'NEAREST',
  1: 'LINEAR',
  2: 'NEAREST_WITH_MIPMAPS',
  3: 'LINEAR_WITH_MIPMAPS',
  4: 'NEAREST_WITH_MIPMAPS_ANISOTROPIC',
  5: 'LINEAR_WITH_MIPMAPS_ANISOTROPIC',
} as const;
