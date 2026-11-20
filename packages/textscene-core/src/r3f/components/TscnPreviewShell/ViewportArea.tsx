import { useViewportMode, type ViewportMode } from '../../contexts/ViewportModeContext.js';
// The claim reads the slice registrations, loaded here so the hint works
// whichever canvas, if any, imported them first.
import '../../nodes/index.js';
import { isClaimedByCanvasItemEditor } from '../../nodeWorkspaceVisibility.js';
import { useLiveSceneNodes } from '../../useLiveSceneTree.js';
import { keepsChildrenInViewport } from '../../viewportRender/viewportBoundary.js';
import type { TscnNode } from '../../../parser/types.js';
import type { Ref } from 'react';
import { TscnCanvas } from '../../TscnCanvas.js';
import type { ViewAnswers } from '../../viewStatus/viewAnswers.js';
import type { ViewStatus } from '../../viewStatus/viewStatus.js';
import { FreelookSpeedReadout } from '../FreelookSpeedReadout/FreelookSpeedReadout.js';
import { GameStartNotes } from './GameStartNotes.js';
import { usePreviewCamera, viewCameraOf } from './previewCamera.js';
import { usePreviewSelection } from './previewSelection.js';
import { ViewportControlsHelp } from '../ViewportControlsHelp/ViewportControlsHelp.js';
import styles from './TscnPreviewShell.module.css';

// Module-level, so the memo of `useLiveSceneNodes` does not recompute each render.
const IS_2D_CONTENT = (node: TscnNode): boolean => isClaimedByCanvasItemEditor(node.type);

interface ViewportAreaProps {
  /** Hears each view's answers as it mounts, and null as it leaves. */
  viewRef: Ref<ViewAnswers>;
  onStatusChange: (status: ViewStatus) => void;
}

export function ViewportArea({ viewRef, onStatusChange }: ViewportAreaProps) {
  const { mode, show } = useViewportMode();
  const camera = viewCameraOf(usePreviewCamera()?.camera ?? null);
  const selection = usePreviewSelection();
  // The view reads the shell's providers: a `scene` prop would mount a second selection and pass.
  return (
    <>
      <TscnCanvas
        mode={mode}
        show={show}
        camera={camera}
        selected={selection?.selected ?? null}
        onSelect={selection?.select}
        onStatusChange={onStatusChange}
        ref={viewRef}
      />
      <ViewportChrome mode={mode} />
    </>
  );
}

function ViewportChrome({ mode }: { mode: ViewportMode }) {
  if (mode === 'in-game') return <GameStartNotes />;
  if (mode === '2D') return <ViewportControlsHelp mode="2D" />;
  return (
    <>
      <ViewportControlsHelp mode="3D" />
      <FreelookSpeedReadout />
      <SwitchTo2DHint />
    </>
  );
}

/** CanvasItem content renders only in the 2D workspace, so the 3D one shows a hint. */
function SwitchTo2DHint() {
  const { setMode } = useViewportMode();
  // The walk stops at a sub-viewport, whose Controls show only on a surface (ADR-0033).
  const has2DContent = useLiveSceneNodes(IS_2D_CONTENT, keepsChildrenInViewport).length > 0;
  if (!has2DContent) return null;
  return (
    <button
      type="button"
      className={styles.viewportHint}
      onClick={() => setMode('2D')}
      title="This scene contains 2D content — switch to the 2D view"
    >
      Has 2D&nbsp;content — switch to 2D
    </button>
  );
}
