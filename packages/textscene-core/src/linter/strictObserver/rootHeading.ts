/**
 * Which `[node]` heading is the scene root. Heading 0 is, and takes the `else` arm of `packed_scene.cpp:206-221`.
 * Every later one takes the `i > 0` arm.
 */

/** A counter to call once per `[node]` heading, in scan order: true for the first call only. */
export function rootHeadingCounter(): () => boolean {
  let nodeHeadings = 0;
  return () => nodeHeadings++ === 0;
}
