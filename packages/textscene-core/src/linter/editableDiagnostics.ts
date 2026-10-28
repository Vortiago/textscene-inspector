/**
 * The diagnostic of an `[editable]` heading the loader refuses. Phase 2 walks the node tree, which holds no `[editable]`
 * heading, so one with no `path=` would otherwise lint clean. The tier and the citation are declared in
 * `fileDiagnostics.ts`, where `emitsGrounding` sweeps them.
 */

import type { StrictScene } from '../parser/types.js';
import type { Diagnostic } from './types.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import { armDiagnostic } from './ruleArms.js';

/** The stand-in for a node: an `[editable]` heading belongs to none, and a diagnostic names a subject. */
const EDITABLE_SUBJECT = { name: '<editable>', type: 'editable' } as const;

export function editableDiagnostics(scene: StrictScene): Diagnostic[] {
  return scene.pathlessEditableLines.map((line) =>
    armDiagnostic(
      FILE_DIAGNOSTICS.editableMissingPath,
      EDITABLE_SUBJECT,
      "Editable heading is missing 'path'. Godot cannot load the file at all: the text loader refuses an " +
        '[editable] tag without one, so nothing in the file is read.',
      { line, column: 1 }
    )
  );
}
