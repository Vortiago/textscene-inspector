/**
 * When a view's reflection asks for another frame. Each frame reflects the colour of the frame
 * before, as Godot's does (`render_forward_clustered.cpp:2414-2417`), so a frame drawn on a change
 * reflects the scene before it. One more frame then reflects the scene it shows. The preview draws
 * only on a change, so it asks for that frame itself.
 */
export class ReflectionFrames {
  /** Whether the next frame is the one the last asked for. Written only by `traced`. */
  private isNextAsked = false;

  /** Counts a frame that traced, and is true when it asks for one more. */
  traced(): boolean {
    const asks = !this.isNextAsked;
    this.isNextAsked = asks;
    return asks;
  }
}
