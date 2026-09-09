/** The 2D stage's zoom readout and its −/+/Fit buttons. */

import styles from './Canvas2DStage.module.css';
import { ZOOM_STEP_BUTTON } from './stageView.js';

export function Canvas2DZoomHud({
  zoom,
  zoomAroundCentre,
  fit,
}: {
  zoom: number;
  zoomAroundCentre: (factor: number) => void;
  fit: () => void;
}) {
  return (
    <div className={styles.zoomHud} role="group" aria-label="Canvas zoom" data-testid="canvas-2d-zoom">
      <button type="button" onClick={() => zoomAroundCentre(1 / ZOOM_STEP_BUTTON)} aria-label="Zoom out">
        −
      </button>
      <span className={styles.zoomVal}>{Math.round(zoom * 100)}%</span>
      <button type="button" onClick={() => zoomAroundCentre(ZOOM_STEP_BUTTON)} aria-label="Zoom in">
        +
      </button>
      <button type="button" className={styles.zoomFit} onClick={fit}>
        Fit
      </button>
    </div>
  );
}
