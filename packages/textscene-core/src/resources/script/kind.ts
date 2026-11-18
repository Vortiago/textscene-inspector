import type { ResourceKind } from '../reading';

/** Where a script lives: its file, or null for a script built into the scene. */
export interface ScriptFile {
  readonly address: string | null;
}

/** A script by its file, read whole: the previewer runs no script, so it decodes none. */
export const SCRIPT_FILE: ResourceKind<ScriptFile> = {
  name: 'Script',
  accepts: () => true,
  readsFilesWhole: true,
  decode: ({ address }) => ({ address }),
};
