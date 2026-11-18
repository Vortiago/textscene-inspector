import { useViewportMode } from '../../contexts/ViewportModeContext.js';
// The claim reads the slice registrations, loaded here so the hint works
// whichever canvas, if any, imported them first.
import '../../nodes/index.js';
import { isClaimedByCanvasItemEditor } from '../../nodeWorkspaceVisibility.js';
import { useLiveSceneNodes } from '../../useLiveSceneTree.js';
import { keepsChildrenInViewport } from '../../viewportRender/viewportBoundary.js';
import type { TscnNode } from '../../../parser/types.js';
import { TscnCanvas } from '../../TscnCanvas.js';
import { FreelookSpeedReadout } from '../FreelookSpeedReadout/FreelookSpeedReadout.js';
import { GameStartNotes } from './GameStartNotes.js';
import { ViewportControlsHelp } from '../ViewportControlsHelp/ViewportControlsHelp.js';
import styles from './TscnPreviewShell.module.css';

// Module-level, so the memo of `useLiveSceneNodes` does not recompute each render.
const IS_2D_CONTENT = (node: TscnNode): boolean => isClaimedByCanvasItemEditor(node.type);

export function ViewportArea() {
  const { mode, setMode } = useViewportMode();
  // The live tree finds 2D content inside a sub-scene too. The walk stops at a
  // sub-viewport, whose Controls show only through a viewport surface. A
  // SubViewportContainer still counts, since it draws in 2D (ADR-0033).
  const has2DContent = useLiveSceneNodes(IS_2D_CONTENT, keepsChildrenInViewport).length > 0;

  // The view reads the shell's providers: a `scene` prop would mount a second selection and pass.
  if (mode === '2D') {
    return (
      <>
        <TscnCanvas mode="2D" />
        <ViewportControlsHelp mode="2D" />
      </>
    );
  }

  if (mode === 'in-game') {
    return (
      <>
        <TscnCanvas mode="in-game" />
        <GameStartNotes />
      </>
    );
  }

  // CanvasItem content renders only in the 2D workspace, so the 3D one shows a hint.
  return (
    <>
      <TscnCanvas />
      <ViewportControlsHelp mode="3D" />
      <FreelookSpeedReadout />
      {has2DContent && (
        <button
          type="button"
          className={styles.viewportHint}
          onClick={() => setMode('2D')}
          title="This scene contains 2D content — switch to the 2D view"
        >
          Has 2D&nbsp;content — switch to 2D
        </button>
      )}
    </>
  );
}
