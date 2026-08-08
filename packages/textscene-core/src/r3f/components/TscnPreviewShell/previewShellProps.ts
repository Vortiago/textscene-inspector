/** The host-facing surface of `<TscnPreviewShell>` — the package's one entry point for embedding a preview panel. */

import type { ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types.js';
import type { ViewportMode } from '../../contexts/ViewportModeContext.js';

export interface TscnPreviewShellProps {
  /** Stable identifier for this panel — used in logs and for context coordination. */
  panelId: string;
  /** Raw TSCN content. Re-parsed via `useMemo` whenever this changes. */
  content: string;
  /** Optional scene path used as the SceneGraph root. Synthetic default suits inline content. */
  rootScenePath?: string;
  /** Fired when a tree row is double-clicked (host can jump to source). */
  onNodeReveal?: (path: string, node: TscnNode) => void;
  onOpenSubScene?: (scenePath: string) => void;
  /** Optional content to inject in the top bar (e.g. a fixture dropdown). */
  toolbar?: ReactNode;
  /**
   * Fired when the user picks a file for a missing-resource row in the
   * `<MissingResourcesPanel>`. Host wires this into its ResourceProvider
   * + ResourceLoader (typically `provider.addUploadedFile` followed by
   * `loader.provideFile`). When omitted, the panel is suppressed
   * because the host has no way to consume uploads.
   */
  onResourceUpload?: (path: string, file: File) => void;
  /**
   * Fired when the user clicks "Remove" on an uploaded row. Host
   * deletes the file from its provider's cache. When omitted, the
   * Remove button still renders but is a no-op.
   */
  onResourceRemove?: (path: string) => void;
  /**
   * Observer for the shell's live missing-resources set — fired after mount
   * and after every change. The explicit surface for host code that lives
   * OUTSIDE the shell (e.g. a page-level drop handler matching dropped files
   * against currently-missing paths) to read the set the shell aggregates.
   */
  onMissingPathsChange?: (paths: ReadonlySet<string>) => void;
  /**
   * Host-provided viewport-mode override (VS Code's `textscene.defaultViewportMode`
   * setting). Omitted (the default) preserves Godot-editor parity: `WorkspaceAutoSelect`
   * (ADR-0006) picks 2D/3D from the scene root's node type. An explicit mode both seeds
   * the initial viewport AND suppresses that auto-select for this panel — otherwise a
   * typed root's own claim would immediately override the host's forced choice, making
   * the setting silently useless for the vast majority of real scenes. A manual toolbar
   * toggle still works afterward in either case.
   */
  initialViewportMode?: ViewportMode;
  /**
   * A Camera3D node path to activate on open (the web previewer resolves it from
   * the `?camera=` query param). Threaded into `<CameraControlProvider>`, which
   * seeds the active camera so the canvas looks through it once the scene loads.
   * Omitted (the default) opens in free-orbit. Hosts without a URL (the VS Code
   * webview) simply never pass it.
   */
  initialActiveCameraPath?: string | null;
}
