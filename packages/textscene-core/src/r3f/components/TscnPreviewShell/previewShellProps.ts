/** The props of `<TscnPreviewShell>`, the package's one entry point for a preview panel. */

import type { ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types.js';
import type { ViewportMode } from '../../contexts/ViewportModeContext.js';

export interface TscnPreviewShellProps {
  /** A stable panel identifier for logs and context coordination. */
  panelId: string;
  /** Raw TSCN content, re-parsed through `useMemo` on each change. */
  content: string;
  /** The scene path of the SceneGraph root. The synthetic default suits inline content. */
  rootScenePath?: string;
  /** Fired when a row is double-clicked, so the host can jump to the source. */
  onNodeReveal?: (path: string, node: TscnNode) => void;
  onOpenSubScene?: (scenePath: string) => void;
  /** Content for the top bar, such as a fixture dropdown. */
  toolbar?: ReactNode;
  /**
   * Fired when the user picks a file for a missing-resource row. Without it
   * the panel is hidden, since the host cannot take an upload.
   */
  onResourceUpload?: (path: string, file: File) => void;
  /**
   * Fired when the user clicks "Remove" on an uploaded row. Without it the
   * button renders and does nothing.
   */
  onResourceRemove?: (path: string) => void;
  /**
   * Fired after mount and after every change of the missing-resources set, for
   * host code outside the shell, such as a page-level drop handler.
   */
  onMissingPathsChange?: (paths: ReadonlySet<string>) => void;
  /**
   * The host's viewport mode, from VS Code's `textscene.defaultViewportMode`.
   * Without it `WorkspaceAutoSelect` (ADR-0006) picks the mode. With it the mode
   * seeds the viewport and turns auto-select off, or a typed root overrides it.
   */
  initialViewportMode?: ViewportMode;
  /**
   * A Camera3D node path to look through once the scene loads, such as the web
   * previewer's `?camera=` parameter. Without it the view opens in free orbit.
   */
  initialActiveCameraPath?: string | null;
}
