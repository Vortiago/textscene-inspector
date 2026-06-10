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
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import type { ControlProperties } from '../control/types';

const DEFAULT_BACKGROUND = 'rgba(42, 42, 46, 0.92)'; // neutral fill for un-themed panels

export function Panel({ node, children }: ControlComponentProps) {
  const props = node.properties as ControlProperties;
  const parentKind = useControlParent();
  const { internalResources } = useSceneResources();
  const styleBoxCss = resolveStyleBoxCss(props.themeOverrideStyles?.panel, internalResources);
  const style: CSSProperties = {
    ...controlLayoutStyle(props, parentKind),
    ...styleBoxCss,
  };
  if (style.backgroundColor === undefined) {
    style.backgroundColor = DEFAULT_BACKGROUND;
  }
  return (
    <div data-control-type="Panel" data-node-name={node.name} style={style}>
      <ControlParentProvider kind="free">{children}</ControlParentProvider>
    </div>
  );
}
