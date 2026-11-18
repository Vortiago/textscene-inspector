import { NotPortable } from '../../notPortable.js';
/** V8's longest array: `new Array(length).fill(null)` takes this length, and one more element throws. */
const MAX_ARRAY_LENGTH = 134_217_725;

/** An Array or a packed array longer than V8 holds, which Godot holds in gigabytes. */
export class UnrepresentableArray extends NotPortable {}

/** `length`, or UnrepresentableArray past MAX_ARRAY_LENGTH. */
export function representableLength(length: number): number {
  if (length > MAX_ARRAY_LENGTH)
    throw new UnrepresentableArray(`expected at most ${MAX_ARRAY_LENGTH} elements, got ${length}`);
  return length;
}
