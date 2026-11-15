import type { LayoutDirectionEnv } from '../godot/scene/control';

/** Godot's own defaults: force off, root direction 0, a left-to-right locale. */
export const LTR_LAYOUT_ENV: LayoutDirectionEnv = {
  forceRtl: false,
  rootRtl: false,
  applicationLocaleRtl: false,
  systemLocaleRtl: false,
  applicationLocale: '',
};
