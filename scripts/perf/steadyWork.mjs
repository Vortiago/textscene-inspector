/** Tells a scene's steady work from the work of a scene that is still loading. */

/**
 * Three times the frames a reflection probe waits after the scene's resources settle
 * (`COMMIT_FRAMES_AFTER_SETTLE`), so the lull before its capture is never taken for steady work.
 */
const STEADY_FRAMES = 30;

export class SteadyWork {
  /** The work last seen, as JSON so two windows compare by value. */
  #lastWork = '';
  #framesSame = 0;

  /**
   * Adds the work of a window and the frames since the previous one. Answers the work once it has
   * stayed the same over STEADY_FRAMES frames, and null before.
   */
  observe(work, frames) {
    const key = JSON.stringify(work);
    if (key !== this.#lastWork) {
      this.#lastWork = key;
      this.#framesSame = 0;
      return null;
    }
    this.#framesSame += frames;
    return this.#framesSame >= STEADY_FRAMES ? work : null;
  }
}
