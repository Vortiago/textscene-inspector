import type { Vector2 } from '../../godot/math/vector';
import type { ProbeCapture } from '../reflectionProbe/captureCameras';
import { rootViewportDescription } from '../viewportRender/viewportDescription';
import { drawWorld } from '../viewportRender/worldRender';
import { DEFAULT_VIEWPORT_HEIGHT, DEFAULT_VIEWPORT_WIDTH } from '../../parser/projectSettingsParser';

/** Runs `draw` as the world draw of a reflection probe capture that draws as `probeCapture` says. */
export function drawAsProbeCapture(probeCapture: ProbeCapture, draw: () => void): void {
  drawWorld(
    { viewport: rootViewportDescription(null), shadowAtlas: null, canvasView: null, probeCapture },
    draw
  );
}

/** Godot's default window: the canvas a pass shows where a test names none. */
const DEFAULT_CANVAS_VIEW: Vector2 = { x: DEFAULT_VIEWPORT_WIDTH, y: DEFAULT_VIEWPORT_HEIGHT };

/** Runs `draw` as the canvas draw of a SubViewport's 2D pass that shows `canvasView` canvas units. */
export function drawAsCanvasPass(draw: () => void, canvasView: Vector2 = DEFAULT_CANVAS_VIEW): void {
  drawWorld({ viewport: rootViewportDescription(null), shadowAtlas: null, canvasView }, draw);
}
