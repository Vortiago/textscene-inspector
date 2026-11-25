import { useViewportMode } from '../ViewportMode/ViewportModeContext.js';
import type { ViewportMode } from '../../viewportMode.js';
import { memo, type Ref } from 'react';
import { TscnCanvas, type CanvasView } from '../../TscnCanvas.js';
import type { ViewStatus } from '../../viewStatus/viewStatus.js';
import { GameStartNotes } from './GameStartNotes.js';
import { SwitchTo2DHint } from './SwitchTo2DHint.js';
import { usePreviewCamera, viewCameraOf } from './previewCamera.js';
import { useOutlinedNode, usePreviewSelection } from './previewSelection.js';
import { ViewportControlsHelp } from '../ViewportControlsHelp/ViewportControlsHelp.js';

interface ViewportAreaProps {
  /** Hears each view's answers as it mounts, and null as it leaves. */
  viewRef: Ref<CanvasView>;
  onStatusChange: (status: ViewStatus) => void;
}

// A memo: the shell re-renders on each status its view reports, and the canvas would rebuild its tree.
export const ViewportArea = memo(function ViewportArea({ viewRef, onStatusChange }: ViewportAreaProps) {
  const { mode, show } = useViewportMode();
  const camera = viewCameraOf(usePreviewCamera()?.camera ?? null);
  const selection = usePreviewSelection();
  const outlined = useOutlinedNode();
  // The view reads the shell's providers: a `scene` prop would mount a second selection and pass.
  return (
    <>
      <TscnCanvas
        mode={mode}
        show={show}
        camera={camera}
        selected={outlined}
        onSelect={selection?.select}
        onStatusChange={onStatusChange}
        ref={viewRef}
      />
      <ViewportChrome mode={mode} />
    </>
  );
});

function ViewportChrome({ mode }: { mode: ViewportMode }) {
  if (mode === 'in-game') return <GameStartNotes />;
  if (mode === '2D') return <ViewportControlsHelp mode="2D" />;
  return (
    <>
      <ViewportControlsHelp mode="3D" />
      <SwitchTo2DHint />
    </>
  );
}
