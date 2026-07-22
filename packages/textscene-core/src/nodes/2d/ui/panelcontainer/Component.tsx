/**
 * <PanelContainer> — draws a StyleBox panel (`theme_override_styles/panel`) and
 * fits its child inside the box's content margins. Godot's PanelContainer is a
 * Container: `fit_child_in_rect` stretches the child to the content rect, so a
 * Label's own `vertical_alignment` (say, CENTER) has height to act on. It thus
 * renders as a flex column and hands its subtree the 'margin' layout kind (the
 * same single-child fill MarginContainer uses); styleBoxToCss maps
 * `content_margin_*` to the padding. Falls back to a default panel fill when no
 * StyleBox override is present.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent, ControlParentProvider } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import { resolveStyleBoxCss } from '../../../../r3f/controls/resolveStyleBox';
import {
  DEFAULT_CONTENT_MARGIN,
  DEFAULT_CORNER_RADIUS,
  STYLE_NORMAL_FILL,
} from '../../../../r3f/controls/godotDefaultTheme';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import type { ControlProperties } from '../control/types';

// Godot's default PanelContainer `panel` stylebox: the button "normal" fill
// with 3px corners and 4px content margins, which inset the child (a
// PanelContainer exists to pad its content). A resolved
// `theme_override_styles/panel` replaces it entirely — including its margins.
const DEFAULT_PANEL_STYLE: CSSProperties = {
  backgroundColor: STYLE_NORMAL_FILL,
  borderRadius: `${DEFAULT_CORNER_RADIUS}px`,
  padding: `${DEFAULT_CONTENT_MARGIN}px`,
};

export function PanelContainer({ node, children }: ControlComponentProps) {
  const props = node.properties as ControlProperties;
  const parentKind = useControlParent();
  const { internalResources } = useSceneResources();
  const styleBoxCss = resolveStyleBoxCss(props.themeOverrideStyles?.panel, internalResources);
  const useDefaults = Object.keys(styleBoxCss).length === 0;
  const layout = controlLayoutStyle(props, parentKind);
  const style: CSSProperties = {
    ...layout,
    ...(useDefaults ? DEFAULT_PANEL_STYLE : styleBoxCss),
    // Flex column so the single child fills the content rect's HEIGHT (the
    // 'margin' child kind adds flex-grow + stretch). Keep a hidden panel hidden
    // — display:none must win over the flex we add here.
    display: layout.display === 'none' ? 'none' : 'flex',
    flexDirection: 'column',
  };
  return (
    <div data-control-type="PanelContainer" data-node-name={node.name} style={style}>
      <ControlParentProvider kind="margin">{children}</ControlParentProvider>
    </div>
  );
}
