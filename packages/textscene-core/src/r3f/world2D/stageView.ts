/** The stage's CSS translate and scale: screen = pan + canvas pixel * zoom. */
export interface StageView {
  pan: { x: number; y: number };
  zoom: number;
}
