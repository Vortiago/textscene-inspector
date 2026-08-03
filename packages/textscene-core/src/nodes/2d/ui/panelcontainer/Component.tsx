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
import { resolveStyleBox } from '../../../../r3f/controls/resolveStyleBox';
import { STYLE_NORMAL_FILL } from '../../../../r3f/controls/godotDefaultTheme';
import { useGodotTheme } from '../../../../r3f/controls/useGodotTheme';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import type { ControlProperties } from '../control/types';

export function PanelContainer({ node, children }: ControlComponentProps) {
  const props = node.properties as ControlProperties;
  const parentKind = useControlParent();
  const { internalResources } = useSceneResources();
  const theme = useGodotTheme();
  const styleBoxCss = resolveStyleBox(props.themeOverrideStyles?.panel, internalResources);
  const layout = controlLayoutStyle(props, parentKind);
  // Godot's default PanelContainer `panel` stylebox: the button "normal" fill
  // with 3px corners and 4px content margins at scale 1, which inset the child
  // (a PanelContainer exists to pad its content). A resolved
  // `theme_override_styles/panel` replaces it entirely — its margins included,
  // and a box that paints nothing replaces the fill with nothing.
  const defaultPanelStyle: CSSProperties = {
    backgroundColor: STYLE_NORMAL_FILL,
    borderRadius: `${theme.cornerRadius}px`,
    padding: `${theme.contentMargin}px`,
  };
  const style: CSSProperties = {
    ...layout,
    ...(styleBoxCss ?? defaultPanelStyle),
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
