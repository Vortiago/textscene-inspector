/**
 * <Panel> — a positioned <div> painted with its `theme_override_styles/panel`
 * StyleBox. Not a container: its children anchor freely against it, so it
 * provides the 'free' layout kind. An un-themed panel falls back to a neutral
 * background so it stays visible.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent, ControlParentProvider } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import { resolveStyleBoxCss } from '../../../../r3f/controls/resolveStyleBox';
import { STYLE_NORMAL_FILL } from '../../../../r3f/controls/godotDefaultTheme';
import { useGodotTheme } from '../../../../r3f/controls/useGodotTheme';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import type { ControlProperties } from '../control/types';

export function Panel({ node, children }: ControlComponentProps) {
  const props = node.properties as ControlProperties;
  const parentKind = useControlParent();
  const { internalResources } = useSceneResources();
  const theme = useGodotTheme();
  const styleBoxCss = resolveStyleBoxCss(props.themeOverrideStyles?.panel, internalResources);
  const useDefaults = Object.keys(styleBoxCss).length === 0;
  // Godot's default Panel `panel` stylebox: the button "normal" fill with 3px
  // corners at scale 1 (no content margins — a Panel's children anchor against
  // its rect, not a padded box). A resolved `theme_override_styles/panel`
  // replaces it entirely.
  const defaultPanelStyle: CSSProperties = {
    backgroundColor: STYLE_NORMAL_FILL,
    borderRadius: `${theme.cornerRadius}px`,
  };
  const style: CSSProperties = {
    ...controlLayoutStyle(props, parentKind),
    ...(useDefaults ? defaultPanelStyle : styleBoxCss),
  };
  return (
    <div data-control-type="Panel" data-node-name={node.name} style={style}>
      <ControlParentProvider kind="free">{children}</ControlParentProvider>
    </div>
  );
}
