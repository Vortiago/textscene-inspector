import type { ProbeCapture } from '../reflectionProbe/captureCameras';
import { rootViewportDescription } from '../viewportRender/viewportDescription';
import { drawWorld } from '../viewportRender/worldRender';

/** Runs `draw` as the world draw of a reflection probe capture that draws as `probeCapture` says. */
export function drawAsProbeCapture(probeCapture: ProbeCapture, draw: () => void): void {
  drawWorld(
    { viewport: rootViewportDescription(null), shadowAtlas: null, hasCanvasTransform: false, probeCapture },
    draw
  );
}

/** Runs `draw` as the canvas draw of a SubViewport's 2D pass, through its Godot canvas transform. */
export function drawAsCanvasPass(draw: () => void): void {
  drawWorld({ viewport: rootViewportDescription(null), shadowAtlas: null, hasCanvasTransform: true }, draw);
}
