/**
 * The reads a computation made on a snapshot, kept with its value: the value still holds while
 * each read answers the same on a later snapshot, since an unchanged answer keeps its identity.
 */

import type { Read, ResourceKind, ResourceSnapshot, ScopedReference } from '../resources/reading';
import type { FileKind } from '../resources/fileKinds.js';

/** One read a computation made, with the answer it got. */
export type RecordedRead =
  | {
      readonly reference: ScopedReference;
      readonly kind: ResourceKind<unknown>;
      readonly answer: Read<unknown>;
    }
  | { readonly fileKind: FileKind<object>; readonly address: string; readonly answer: Read<unknown> };

/** Whether each of `reads` answers the same on `snapshot`. */
export function answersTheSame(reads: readonly RecordedRead[], snapshot: ResourceSnapshot): boolean {
  return reads.every((read) => answerNow(read, snapshot) === read.answer);
}

function answerNow(read: RecordedRead, snapshot: ResourceSnapshot): Read<unknown> {
  return 'kind' in read
    ? snapshot.read(read.reference, read.kind)
    : snapshot.loaded(read.fileKind, read.address);
}

/** `snapshot`, with each read it answers added to `reads`. */
export function recording(snapshot: ResourceSnapshot, reads: RecordedRead[]): ResourceSnapshot {
  return {
    read(reference, kind) {
      const answer = snapshot.read(reference, kind);
      reads.push({ reference, kind: kind as ResourceKind<unknown>, answer });
      return answer;
    },
    loaded(fileKind, address) {
      const answer = snapshot.loaded(fileKind, address);
      reads.push({ fileKind: fileKind as FileKind<object>, address, answer });
      return answer;
    },
  };
}
