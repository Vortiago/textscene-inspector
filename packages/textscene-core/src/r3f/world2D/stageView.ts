export interface StageView {
  pan: { x: number; y: number };
  /** The stage's CSS scale: a canvas pixel p lands on screen at pan + p * zoom. */
  zoom: number;
}
