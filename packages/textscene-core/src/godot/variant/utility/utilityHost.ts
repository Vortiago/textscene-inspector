import type { Decoders } from '../../io/compression/compression.js';
import { GlobalRandom } from './globalRandom.js';

/** What a call reads beyond its arguments: the global random generator, the project's files, the decoders. */
export interface UtilityHost {
  readonly random: GlobalRandom;
  /** Whether the project holds a file at `path`, a `res://` path or one of another scheme. */
  readonly hasFile: (path: string) => boolean;
  /** The third-party decoders `decompress` uses, which `godot/` cannot import. */
  readonly decoders?: Decoders;
}

/** A host of a fresh generator, over a project of no files unless `hasFile` names them. */
export const utilityHost = (
  hasFile: (path: string) => boolean = () => false,
  decoders?: Decoders
): UtilityHost => ({
  random: new GlobalRandom(),
  hasFile,
  decoders,
});
