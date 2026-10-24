/**
 * The diagnostics of the `[connection]` headings. Phase 2 walks the node tree, which holds no connection, so a
 * heading the loader refuses or one that names no node would otherwise lint clean. Tiers and citations are
 * declared in `fileDiagnostics.ts`, where `emitsGrounding` sweeps them.
 */

import type { ConnectionHeading, StrictScene } from '../parser/types.js';
import type { Diagnostic } from './types.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import { armDiagnostic } from './ruleArms.js';

const REQUIRED_FIELDS = ['from', 'to', 'signal', 'method'] as const;

/** The stand-in for a node: a connection belongs to none, and a diagnostic names a subject. */
const CONNECTION_SUBJECT = { name: '<connection>', type: 'connection' } as const;

function missingFieldDiagnostic(connection: ConnectionHeading): Diagnostic[] {
  const missing = REQUIRED_FIELDS.filter((field) => connection[field] === undefined);
  if (missing.length === 0) return [];
  const names = missing.map((field) => `'${field}'`).join(', ');
  return [
    armDiagnostic(
      FILE_DIAGNOSTICS.connectionMissingField,
      CONNECTION_SUBJECT,
      `Connection heading is missing ${names}. Godot cannot load the file at all: the text loader ` +
        'refuses a connection that lacks one, so nothing in the file is read.',
      { line: connection.line, column: 1 }
    ),
  ];
}

/** One end of a connection: its field, the path written, and the id trail Godot falls back to. */
interface ConnectionEnd {
  field: 'from' | 'to';
  path: string | undefined;
  idTrail: readonly number[] | undefined;
}

function endsOf({ from, to, fromIdTrail, toIdTrail }: ConnectionHeading): ConnectionEnd[] {
  return [
    { field: 'from', path: from, idTrail: fromIdTrail },
    { field: 'to', path: to, idTrail: toIdTrail },
  ];
}

function missingNodeDiagnostics(scene: StrictScene, connection: ConnectionHeading): Diagnostic[] {
  // A file with no node instantiates nothing (packed_scene.cpp:171), so no connection is made or skipped.
  if (scene.nodes.length === 0) return [];
  return endsOf(connection).flatMap(({ field, path, idTrail }) => {
    if (path === undefined) return [];
    if (scene.resolveConnectionEnd(path, idTrail).status !== 'missing') return [];
    return [
      armDiagnostic(
        FILE_DIAGNOSTICS.connectionNodeMissing,
        CONNECTION_SUBJECT,
        `Connection ${field}="${path}" names no node in this file. Godot loads the scene and skips the ` +
          'connection, so the signal never reaches the method.',
        { line: connection.line, column: 1 }
      ),
    ];
  });
}

export function connectionDiagnostics(scene: StrictScene): Diagnostic[] {
  return scene.connections.flatMap((connection) => [
    ...missingFieldDiagnostic(connection),
    ...missingNodeDiagnostics(scene, connection),
  ]);
}
