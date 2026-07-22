/**
 * <PanelContainer> — draws a StyleBox panel (`theme_override_styles/panel`) and
 * lays its child inside the box's content margins. styleBoxToCss already maps
 * `content_margin_*` to CSS padding, so the child sits naturally in flow.
 * Provides the 'block' layout kind to its subtree. Falls back to a default
 * panel fill when no StyleBox override is present.
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
  const style: CSSProperties = {
    ...controlLayoutStyle(props, parentKind),
    ...(useDefaults ? DEFAULT_PANEL_STYLE : styleBoxCss),
  };
  return (
    <div data-control-type="PanelContainer" data-node-name={node.name} style={style}>
      <ControlParentProvider kind="block">{children}</ControlParentProvider>
    </div>
  );
}
