/**
 * The Control-overlay targets: a fixture per Control behaviour the overlay has
 * to get right, each with the expectations that turn it from a report into a
 * gate.
 */

export const CONTROL_TARGETS = [
  // Its `Icon` TextureRect declares no `texture` at all (a layout placeholder in
  // the mockup), so one dashed fallback is the correct render, not a defect.
  ['ui-dialog', 'example-ui-dialog.tscn', { minControls: 5, maxFallbacks: 1 }],
  ['control-containers', 'unit-control-containers.tscn', { minControls: 5 }],
  ['bbcode', 'unit-rich-text-label.tscn', { minControls: 1 }],
  // Controls living inside instanced sub-scenes, nested two deep behind a
  // Node3D root — the shape every real Godot HUD uses.
  [
    'control-instanced-hud',
    'unit-control-instanced-hud.tscn',
    { minControls: 5, types: ['Label', 'TextureRect'], texts: ['HUD LAYER', 'BADGE'] },
  ],
  // A Control parented to each of the five Control types that used to render
  // only `node` and drop the `children` ControlDispatcher handed them. Every
  // other 2D fixture nests under containers, which forward children, so the
  // loss was invisible: the five UNDER * strings are what proves it.
  // Checked/unchecked/radio indicators, and three Control types whose own
  // `display` default used to overwrite a hidden node's `display: none`.
  [
    'control-state',
    'unit-control-state.tscn',
    {
      minControls: 8,
      types: ['CheckBox', 'OptionButton', 'Button', 'GridContainer'],
      texts: ['VISIBLE DROPDOWN'],
      hiddenNodes: ['HiddenDropdown', 'HiddenButton', 'HiddenGrid'],
      indicators: [
        ['checked', 'check', 1],
        ['unchecked', 'check', 1],
        ['checked', 'radio', 1],
        ['unchecked', 'radio', 1],
      ],
    },
  ],
  // modulate (opacity + tint filter), the Control transform, FILL-beats-SHRINK
  // size-flag precedence, TextureRect's expand_mode minimum, and Button.icon.
  [
    'control-transform-modulate',
    'unit-control-transform-modulate.tscn',
    {
      minControls: 9,
      types: ['Label', 'TextureRect', 'Button', 'HBoxContainer', 'CenterContainer'],
      loadedIcons: 1,
      computed: [
        ['FadedLabel', 'opacity', (v) => Math.abs(Number(v) - 0.4) < 0.01, '0.4'],
        ['TintedLabel', 'filter', (v) => v !== 'none', 'a colour-multiply filter'],
        ['PlainLabel', 'filter', (v) => v === 'none', 'no filter'],
        ['RotatedIcon', 'transform', (v) => v !== 'none', 'a rotation matrix'],
        ['MirroredLabel', 'transform', (v) => v.includes('-1'), 'a mirrored matrix'],
        // FILL|SHRINK_CENTER must STRETCH; SHRINK_CENTER alone must centre.
        ['FillCentreLabel', 'alignSelf', (v) => v === 'stretch', 'stretch'],
        ['ShrinkCentreLabel', 'alignSelf', (v) => v === 'center', 'center'],
        // EXPAND_KEEP_SIZE floors the control at the texture's own size.
        ['LogoInContainer', 'width', (v) => v > 0, 'a non-zero width'],
        ['LogoInContainer', 'height', (v) => v > 0, 'a non-zero height'],
      ],
    },
  ],
  [
    'control-nested-children',
    'unit-control-nested-children.tscn',
    {
      minControls: 11,
      types: ['Label', 'CheckBox', 'OptionButton', 'TextureRect', 'RichTextLabel'],
      texts: [
        'UNDER LABEL',
        'UNDER CHECKBOX',
        'UNDER OPTION',
        'UNDER TEXTURE',
        'UNDER RICHTEXT',
      ],
    },
  ],
];
