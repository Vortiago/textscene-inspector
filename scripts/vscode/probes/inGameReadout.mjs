/* global document */
// `document` exists only in the webview frame, where `frame.evaluate` runs this.
export default function inGameReadout() {
  const button = [...document.querySelectorAll('button')].find((each) => each.textContent === 'In-game');
  return {
    isPressed: button?.getAttribute('aria-pressed') === 'true',
    // `CANVAS_2D_TESTIDS.stage`: `frame.evaluate` serialises this function, so no import reaches it.
    showsStage: document.querySelector('[data-testid="canvas-2d-stage"]') !== null,
  };
}
