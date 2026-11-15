/**
 * The reads a computation made on a snapshot, kept with its value: the value still holds while
 * each read answers the same on a later snapshot, since an unchanged answer keeps its identity.
 */

import {
  sameReference,
  type Read,
  type ResourceKind,
  type ResourceSnapshot,
  type ScopedReference,
} from '../resources/reading';
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

/** Whether `reads` read every file that `others` read: the same reference as the same kind, or the same address. */
export function readsCover(reads: readonly RecordedRead[], others: readonly RecordedRead[]): boolean {
  return others.every((other) => reads.some((read) => isSameRead(read, other)));
}

function isSameRead(a: RecordedRead, b: RecordedRead): boolean {
  if ('kind' in a) return 'kind' in b && a.kind === b.kind && sameReference(a.reference, b.reference);
  return !('kind' in b) && a.fileKind === b.fileKind && a.address === b.address;
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
