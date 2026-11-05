/**
 * The Controls of one sub-viewport or embedded window, drawn by the native Control walker into the
 * canvas the viewport's pass renders, with the windows it embeds over them. A Control-only viewport
 * mounts it in its own detached scene (`ControlRasterPass.tsx`). A viewport that also holds 2D-world
 * content mounts it in the portal beside those items, so both share one paint range and the
 * Camera2D frames them together.
 */
import { useMemo } from 'react';

// The barrel, not `ControlCanvasWalker.tsx`: its side-effect imports register every `Native` painter,
// which a canvas with no on-screen Controls never loads otherwise, leaving each Control a
// `<ControlFallback>` outline. Callers lazy-load this module, so a scene with no Controls in a
// viewport pays nothing.
import '../../../r3f/controls/index.js';
import { useProjectSettings } from '../../../r3f/contexts/ProjectSettingsContext.js';
import { useSceneResources } from '../../../r3f/SceneResourcesContext.js';
import { useBuildViewportTree } from '../../../r3f/controls/native/buildSolveTree.js';
import { ControlCanvasWalker } from '../../../r3f/controls/native/ControlCanvasWalker.js';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme.js';
import { measureText } from '../../../r3f/controls/native/text/measurer.js';
import type { Rect2 } from '../../../godot/math/rect2.js';
import type { Vector2 } from '../../../godot/math/vector.js';
import type { TscnNode } from '../../../parser/types.js';
import { EmbeddedWindows } from '../../windows/window/EmbeddedWindows.js';
import type { ThemeOwner } from '../../windows/window/themeOwners.js';
import { usePublishWrappedSize } from '../../windows/window/usePublishWrappedSize.js';
import { parentPathOf } from '../../../utils/nodePath.js';
import { isEmbeddedWindow } from './viewportBoundary.js';

interface ViewportControlsProps {
  /** The viewport's live path. */
  path: string;
  /** The sub-viewport or window. The walker draws its Controls and skips the rest. */
  viewport: TscnNode;
  /** The viewport's pixels: the rect the Controls anchor against. */
  size: Vector2;
  /**
   * `Control::is_layout_rtl()` of the Control around the viewport, or `null` where there is none.
   * The climb steps straight over a `SubViewport` (`control.cpp:3584-3598`), so this forest starts
   * from it, not from scratch.
   */
  inheritedRtl: boolean | null;
  /** The theme owners above a window (`viewportThemeOwners`). */
  themeOwners: readonly ThemeOwner[];
  /** The viewport's `gui_embed_subwindows`: whether it draws its windows over its Controls. */
  embedsWindows: boolean;
}

export function ViewportControls({
  path,
  viewport,
  size,
  inheritedRtl,
  themeOwners,
  embedsWindows,
}: ViewportControlsProps) {
  const { externalResources, internalResources } = useSceneResources();
  const { themeScale } = useProjectSettings();
  const theme = useMemo(() => nativeTheme(themeScale), [themeScale]);
  const { tree, generation, windows } = useBuildViewportTree(
    viewport,
    externalResources,
    internalResources,
    themeOwners,
    inheritedRtl
  );
  const isWindow = isEmbeddedWindow(viewport.type);
  usePublishWrappedSize(path, isWindow ? (tree[0] ?? null) : null, theme, measureText, generation);
  const rect: Rect2 = useMemo(() => ({ x: 0, y: 0, w: size.x, h: size.y }), [size.x, size.y]);
  // A window's forest is rooted at the window itself, a SubViewport's at its children.
  const forestPath = isWindow ? (parentPathOf(path) ?? '') : path;

  return (
    <>
      <ControlCanvasWalker
        tree={tree}
        generation={generation}
        viewport={rect}
        theme={theme}
        measurer={measureText}
        // `scene/main/viewport.h`: `bool snap_controls_to_pixels = true` on every Viewport, and only the
        // root window receives `gui/common/snap_controls_to_pixels` (`main/main.cpp`), so the project's
        // opt-out never reaches a sub-viewport's Controls.
        snapToPixels
      />
      {embedsWindows ? (
        <EmbeddedWindows windows={windows} embedderSize={size} forestPath={forestPath} theme={theme} />
      ) : null}
    </>
  );
}
