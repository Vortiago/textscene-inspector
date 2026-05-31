/**
 * <Button> — renders the NORMAL visual state as a positioned, centered <div>
 * (this is a viewer, not an interactive control). The `normal` StyleBox override
 * drives background/border; absent that (and unless `flat`) a sensible default
 * button chrome is applied. Font size/color come from the theme overrides; a
 * system font stack is used (the VS Code webview CSP blocks web fonts).
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import { controlColorToCss } from '../../../../r3f/controls/styleBoxToCss';
import { resolveStyleBoxCss } from '../../../../r3f/controls/resolveStyleBox';
import type { ButtonProperties } from './types';

const DEFAULTS: CSSProperties = {
  padding: '6px 14px',
  borderRadius: '4px',
  backgroundColor: 'rgba(70, 78, 94, 0.95)',
  color: '#e8e8ea',
};

export function Button({ node, children }: ControlComponentProps) {
  const props = node.properties as ButtonProperties;
  const parentKind = useControlParent();
  const { internalResources } = useSceneResources();

  const styleBoxCss = resolveStyleBoxCss(props.themeOverrideStyles?.normal, internalResources);
  const useDefaults = !props.flat && Object.keys(styleBoxCss).length === 0;

  const style: CSSProperties = {
    ...controlLayoutStyle(props, parentKind),
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    cursor: props.disabled ? 'default' : 'pointer',
    textAlign: 'center',
    ...(useDefaults ? DEFAULTS : {}),
    ...styleBoxCss,
  };

  const fontSize = props.themeOverrideFontSizes?.font_size;
  if (fontSize) style.fontSize = `${fontSize}px`;
  const fontColor = props.themeOverrideColors?.font_color;
  if (fontColor) style.color = controlColorToCss(fontColor);
  if (props.disabled) style.opacity = 0.6;

  return (
    <div data-control-type="Button" data-node-name={node.name} style={style}>
      {props.text ?? ''}
      {children}
    </div>
  );
}
