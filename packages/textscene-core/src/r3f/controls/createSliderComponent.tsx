/**
 * Factory for the two 2D-overlay slider Controls (HSlider/VSlider). Godot draws
 * both from the SAME `Slider::_notification(NOTIFICATION_DRAW)` body with one
 * `orientation` branch, so the overlay mirrors that: one component, one config
 * field. Each part gets a `data-slider-part` hook because the CSS goldens are
 * WebGL-canvas-only (ADR-0024) — `pnpm verify:2d` is what can see these boxes,
 * and it needs to name them.
 *
 * Sliders are leaf Controls, but a Control parented to one still renders on top
 * of it in Godot, so `children` is forwarded like every other Control's.
 */
import type { CSSProperties } from 'react';
import type { ControlComponent, ControlComponentProps } from './ControlComponentRegistry';
import { useControlParent, ControlParentProvider } from './ControlParentContext';
import { controlStyle } from './controlLayout';
import { sliderChrome, type SliderOrientation } from './sliderChrome';
import { useGodotTheme } from './useGodotTheme';
import type { SliderProperties } from '../../nodes/2d/ui/shared/slider';

export interface SliderConfig {
  /** Godot type name, 'HSlider' or 'VSlider'. */
  typeName: string;
  orientation: SliderOrientation;
}

export function createSliderComponent(config: SliderConfig): ControlComponent {
  function Slider({ node, children }: ControlComponentProps) {
    const props = node.properties as SliderProperties;
    const parentKind = useControlParent();
    // Metrics at the project's `gui/theme/default_theme_scale`, never the raw
    // constants: Godot bakes that scale into its default theme, so a slider
    // reading the unscaled sizes would sit at a fraction of its neighbours.
    const theme = useGodotTheme();
    const chrome = sliderChrome(props, config.orientation, theme);
    // The parts are absolutely positioned against this box; both layout regimes
    // (`absolute` when free, `relative` inside a container) already establish
    // the containing block they need.
    const style: CSSProperties = controlStyle(props, parentKind, chrome.root);

    return (
      <div data-control-type={config.typeName} data-node-name={node.name} style={style}>
        <div data-slider-part="track" style={chrome.track} />
        <div data-slider-part="fill" style={chrome.fill} />
        {chrome.ticks.map((tick, i) => (
          <div key={i} data-slider-part="tick" style={tick} />
        ))}
        <div data-slider-part="grabber" style={chrome.grabber} />
        <ControlParentProvider kind="free">{children}</ControlParentProvider>
      </div>
    );
  }
  Slider.displayName = config.typeName;
  return Slider;
}
