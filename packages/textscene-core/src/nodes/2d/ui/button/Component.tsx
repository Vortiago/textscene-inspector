/**
 * <Button> — renders the NORMAL visual state as a positioned, centered <div>
 * (this is a viewer, not an interactive control). The `normal` StyleBox override
 * drives background/border; absent that (and unless `flat`) a sensible default
 * button chrome is applied. Font size/color come from the theme overrides; a
 * system font stack is used (the VS Code webview CSP blocks web fonts).
 */

import { useMemo, type CSSProperties } from 'react';
import type * as THREE from 'three';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { controlStyle } from '../../../../r3f/controls/controlLayout';
import { textThemeStyle } from '../../../../r3f/controls/textThemeStyle';
import { resolveStyleBoxCss } from '../../../../r3f/controls/resolveStyleBox';
import { imageToDataUrl } from '../../../../r3f/controls/imageToDataUrl';
import {
  DEFAULT_CONTENT_MARGIN,
  DEFAULT_CORNER_RADIUS,
  DEFAULT_FONT_COLOR,
  DEFAULT_FONT_SIZE,
  STYLE_NORMAL_FILL,
} from '../../../../r3f/controls/godotDefaultTheme';
import { resolveTexture2DPath } from '../../../../resources/SubResourceResolver';
import { useResource } from '../../../../resources/useResource';
import type { ButtonProperties } from './types';

// Godot's button "normal" StyleBoxFlat: dark translucent fill, 4px content
// margins, 3px corners — from the default theme, so an un-styled Button matches
// the engine rather than a hand-picked slate. A `theme_override_styles/normal`
// StyleBox replaces this entirely (styleBoxCss below wins).
const DEFAULTS: CSSProperties = {
  padding: `${DEFAULT_CONTENT_MARGIN}px`,
  borderRadius: `${DEFAULT_CORNER_RADIUS}px`,
  backgroundColor: STYLE_NORMAL_FILL,
  fontSize: `${DEFAULT_FONT_SIZE}px`,
  color: DEFAULT_FONT_COLOR,
};

// Godot Button.alignment (HorizontalAlignment): 0 LEFT, 1 CENTER, 2 RIGHT.
const JUSTIFY = ['flex-start', 'center', 'flex-end'] as const;
const TEXT_ALIGN = ['left', 'center', 'right'] as const;

export function Button({ node, children }: ControlComponentProps) {
  const props = node.properties as ButtonProperties;
  const parentKind = useControlParent();
  const { internalResources } = useSceneResources();

  const styleBoxCss = resolveStyleBoxCss(props.themeOverrideStyles?.normal, internalResources);
  const useDefaults = !props.flat && Object.keys(styleBoxCss).length === 0;

  const alignment = props.alignment ?? 1; // Godot default: CENTER
  const style: CSSProperties = controlStyle(
    props,
    parentKind,
    {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: JUSTIFY[alignment] ?? 'center',
      boxSizing: 'border-box',
      cursor: props.disabled ? 'default' : 'pointer',
      textAlign: TEXT_ALIGN[alignment] ?? 'center',
    },
    useDefaults ? DEFAULTS : {},
    styleBoxCss,
    textThemeStyle(props, { sizeKey: 'font_size', colorKey: 'font_color' })
  );

  if (props.disabled) style.opacity = 0.6;

  return (
    <div data-control-type="Button" data-node-name={node.name} style={style}>
      <ButtonIcon icon={props.icon} name={node.name} expand={props.expandIcon === true} />
      {props.text ?? ''}
      {children}
    </div>
  );
}

/** Gap between an icon and the label, matching the theme's `h_separation`. */
const ICON_TEXT_GAP = 4;
/** Icon box when `expand_icon` is off — Godot draws it at its natural size. */
const ICON_SIZE = 16;

/**
 * `Button.icon` — drawn before the text at Godot's default `icon_alignment`
 * (LEFT) and `vertical_icon_alignment` (CENTER). An icon-only Button is a real
 * shape: `scenes/demos/3d/truck_town/car_select/car_select.tscn` is three of
 * them, and without this they rendered as empty chrome.
 */
function ButtonIcon({
  icon,
  name,
  expand,
}: {
  icon: string | undefined;
  name: string;
  expand: boolean;
}) {
  const { externalResources, internalResources } = useSceneResources();
  const path = resolveTexture2DPath(icon, externalResources, internalResources);
  // Always call the hook (rules of hooks); '' short-circuits to pending.
  const tex = useResource<THREE.Texture>(path ?? '', 'Texture2D');
  const src = useMemo(() => imageToDataUrl(tex.value?.image), [tex.value]);
  if (!icon) return null;

  const style: CSSProperties = {
    flex: '0 0 auto',
    marginRight: `${ICON_TEXT_GAP}px`,
    objectFit: 'contain',
    // `expand_icon` scales the icon to the button while keeping its aspect;
    // otherwise Godot draws it at its own size.
    ...(expand
      ? { maxWidth: '100%', maxHeight: '100%' }
      : { width: `${ICON_SIZE}px`, height: `${ICON_SIZE}px` }),
  };

  if (!src) {
    // The texture has not resolved: keep the icon's box so the button does not
    // silently collapse to its (possibly empty) label.
    return <span data-button-icon="pending" style={{ ...style, display: 'inline-block' }} />;
  }
  return <img data-button-icon="loaded" src={src} alt={`${name} icon`} style={style} />;
}
