import type { ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types.js';
import type { ViewportMode } from '../ViewportMode/ViewportModeContext.js';
import type { PreviewCaptureState } from './previewCaptureState.js';
import type { Scene } from '../../../scene/openScene.js';
import type { NodeHandle } from '../../../scene/nodeHandle.js';

export interface TscnPreviewShellProps {
  /** A stable panel identifier for logs and context coordination. */
  panelId: string;
  /** The scene `openScene` gave. The host owns it: it sets the text and disposes it. */
  scene: Scene;
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
   * The host's viewport mode, from VS Code's `textscene.defaultViewportMode`.
   * Without it `WorkspaceAutoSelect` (ADR-0006) picks the mode. With it the mode
   * seeds the viewport and turns auto-select off, or a typed root overrides it.
   */
  initialViewportMode?: ViewportMode;
  /**
   * A Camera3D node path to look through once the scene loads, such as the web
   * previewer's `?camera=` parameter. Without it the view opens on the editor camera.
   */
  initialPreviewedCameraPath?: string | null;
  /**
   * Fired on mount and on each change of whether the viewport can capture a PNG. The
   * `ready` state carries the capture, which the host saves or hands to an agent tool.
   * The shell reports `pending` as it unmounts.
   */
  onCaptureStateChange?: (state: PreviewCaptureState) => void;
  /**
   * Whether the host shows the preview. While `false` the canvas renders no frame and runs no frame
   * callback, and a capture still returns the picture. Without it the preview shows.
   */
  isVisible?: boolean;
  /** The host's selection, as the view's `selected`. Without it the shell keeps its own. */
  selected?: NodeHandle | null;
  /** Fired with the node the tree, the view or Escape selects, or null for none. */
  onSelect?: (node: NodeHandle | null) => void;
  /** Fired with the node path the Inspector copies, for the host to put on the clipboard. Without it the row has no copy button. */
  onCopyNodePath?: (nodePath: string) => void;
}
