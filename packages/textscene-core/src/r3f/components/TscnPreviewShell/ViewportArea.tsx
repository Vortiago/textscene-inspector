import { useViewportMode, type ViewportMode } from '../../contexts/ViewportModeContext.js';
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
  const { mode } = useViewportMode();
  // The view reads the shell's providers: a `scene` prop would mount a second selection and pass.
  return (
    <>
      <TscnCanvas mode={mode} />
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
