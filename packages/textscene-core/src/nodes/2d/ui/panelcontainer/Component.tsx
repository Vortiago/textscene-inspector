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
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import type { ControlProperties } from '../control/types';

const DEFAULT_PANEL_BACKGROUND = 'rgba(42, 42, 46, 0.92)'; // Godot default panel fill

export function PanelContainer({ node, children }: ControlComponentProps) {
  const props = node.properties as ControlProperties;
  const parentKind = useControlParent();
  const { internalResources } = useSceneResources();
  const styleBoxCss = resolveStyleBoxCss(props.themeOverrideStyles?.panel, internalResources);
  const style: CSSProperties = {
    ...controlLayoutStyle(props, parentKind),
    backgroundColor: DEFAULT_PANEL_BACKGROUND,
    ...styleBoxCss,
  };
  return (
    <div data-control-type="PanelContainer" data-node-name={node.name} style={style}>
      <ControlParentProvider kind="block">{children}</ControlParentProvider>
    </div>
  );
}
