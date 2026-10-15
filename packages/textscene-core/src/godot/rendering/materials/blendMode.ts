/** A BaseMaterial3D's blend mode and the colour blend attachment Godot programs for each. */

/**
 * `BaseMaterial3D::BlendMode` (`scene/resources/material.h:227-233`), as the integers a `.tscn`
 * stores for `blend_mode`. The default is MIX (`material.h:601`). `CanvasItemMaterial` uses the
 * same values.
 */
export enum BlendMode {
  MIX = 0,
  ADD = 1,
  SUB = 2,
  MUL = 3,
  PREMULT_ALPHA = 4,
}

/** `RD::BlendOperation`, only the two values the attachments use. */
export type GodotBlendOp = 'add' | 'reverse-subtract';

/** `RD::BlendFactor`, only the values the attachments use. */
export type GodotBlendFactor =
  'zero' | 'one' | 'src-alpha' | 'one-minus-src-alpha' | 'dst-color' | 'dst-alpha';

/** One `RD::PipelineColorBlendState::Attachment`, in Godot's vocabulary. */
export interface GodotBlendAttachment {
  colorOp: GodotBlendOp;
  srcColor: GodotBlendFactor;
  dstColor: GodotBlendFactor;
  alphaOp: GodotBlendOp;
  srcAlpha: GodotBlendFactor;
  dstAlpha: GodotBlendFactor;
}

/**
 * `blend_mode_to_blend_attachment` (`servers/rendering/renderer_rd/storage_rd/material_storage.cpp:651-716`),
 * verbatim. Every mode enables blending, and the alpha channel gets its own factors in all five.
 */
export const GODOT_BLEND_ATTACHMENTS: Readonly<Record<BlendMode, GodotBlendAttachment>> = {
  [BlendMode.MIX]: {
    colorOp: 'add',
    srcColor: 'src-alpha',
    dstColor: 'one-minus-src-alpha',
    alphaOp: 'add',
    srcAlpha: 'one',
    dstAlpha: 'one-minus-src-alpha',
  },
  [BlendMode.ADD]: {
    colorOp: 'add',
    srcColor: 'src-alpha',
    dstColor: 'one',
    alphaOp: 'add',
    srcAlpha: 'src-alpha',
    dstAlpha: 'one',
  },
  [BlendMode.SUB]: {
    colorOp: 'reverse-subtract',
    srcColor: 'src-alpha',
    dstColor: 'one',
    alphaOp: 'reverse-subtract',
    srcAlpha: 'src-alpha',
    dstAlpha: 'one',
  },
  [BlendMode.MUL]: {
    colorOp: 'add',
    srcColor: 'dst-color',
    dstColor: 'zero',
    alphaOp: 'add',
    srcAlpha: 'dst-alpha',
    dstAlpha: 'zero',
  },
  [BlendMode.PREMULT_ALPHA]: {
    colorOp: 'add',
    srcColor: 'one',
    dstColor: 'one-minus-src-alpha',
    alphaOp: 'add',
    srcAlpha: 'one',
    dstAlpha: 'one-minus-src-alpha',
  },
};

/**
 * `BLEND_MODE_ALPHA_TO_COVERAGE` (`material_storage.cpp:691-698`), which any alpha antialiasing mode
 * puts in place of the material's own blend mode (`scene_shader_forward_clustered.cpp:237-241`).
 */
export const ALPHA_TO_COVERAGE_ATTACHMENT: GodotBlendAttachment = {
  colorOp: 'add',
  srcColor: 'src-alpha',
  dstColor: 'one-minus-src-alpha',
  alphaOp: 'add',
  srcAlpha: 'one',
  dstAlpha: 'zero',
};
