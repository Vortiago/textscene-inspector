/**
 * The Controls of one sub-viewport, drawn by the native Control walker into the canvas the
 * viewport's pass renders. A Control-only viewport mounts it in its own detached scene
 * (`ControlRasterPass.tsx`). A viewport that also holds 2D-world content mounts it in the portal
 * beside those items, so both share one paint range and the Camera2D frames them together.
 */
import { useMemo } from 'react';

// The barrel, not `ControlCanvasWalker.tsx`: its side-effect imports register every `Native` painter,
// which a canvas with no on-screen Controls never loads otherwise, leaving each Control a
// `<ControlFallback>` outline. Callers lazy-load this module, so a scene with no Controls in a
// viewport pays nothing.
import '../../../r3f/controls/index.js';
import { useProjectSettings } from '../../../r3f/contexts/ProjectSettingsContext.js';
import { useSceneResources } from '../../../r3f/SceneResourcesContext.js';
import { useBuildSolveTree } from '../../../r3f/controls/native/buildSolveTree.js';
import { ControlCanvasWalker } from '../../../r3f/controls/native/ControlCanvasWalker.js';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme.js';
import { measureText } from '../../../r3f/controls/native/text/measurer.js';
import type { Rect2 } from '../../../godot/math/rect2.js';
import type { Vector2 } from '../../../godot/math/vector.js';
import type { TscnNode } from '../../../parser/types.js';

interface ViewportControlsProps {
  /** The sub-viewport's children. The walker draws their Controls and skips the rest. */
  nodes: readonly TscnNode[];
  /** The viewport's pixels: the rect the Controls anchor against. */
  size: Vector2;
  /**
   * `Control::is_layout_rtl()` of the Control around the viewport, or `null` where there is none.
   * The climb steps straight over a `SubViewport` (`control.cpp:3584-3598`), so this forest starts
   * from it, not from scratch.
   */
  inheritedRtl: boolean | null;
}

export function ViewportControls({ nodes, size, inheritedRtl }: ViewportControlsProps) {
  const { externalResources, internalResources } = useSceneResources();
  const { themeScale } = useProjectSettings();
  const theme = useMemo(() => nativeTheme(themeScale), [themeScale]);
  const { tree, generation } = useBuildSolveTree(nodes, externalResources, internalResources, inheritedRtl);
  const viewport: Rect2 = useMemo(() => ({ x: 0, y: 0, w: size.x, h: size.y }), [size.x, size.y]);

  return (
    <ControlCanvasWalker
      tree={tree}
      generation={generation}
      viewport={viewport}
      theme={theme}
      measurer={measureText}
      // `scene/main/viewport.h`: `bool snap_controls_to_pixels = true` on every Viewport, and only the
      // root window receives `gui/common/snap_controls_to_pixels` (`main/main.cpp`), so the project's
      // opt-out never reaches a sub-viewport's Controls.
      snapToPixels
    />
  );
}
