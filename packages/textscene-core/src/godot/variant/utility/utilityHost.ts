import { GlobalRandom } from './globalRandom.js';

/** What a utility call reads beyond its arguments: the global random generator and the project's files. */
export interface UtilityHost {
  readonly random: GlobalRandom;
  /** Whether the project holds a file at `path`, a `res://` path or one of another scheme. */
  readonly hasFile: (path: string) => boolean;
}

/** A host of a fresh generator, over a project of no files unless `hasFile` names them. */
export const utilityHost = (hasFile: (path: string) => boolean = () => false): UtilityHost => ({
  random: new GlobalRandom(),
  hasFile,
});
