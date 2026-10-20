/**
 * A `[connection]` heading the loader cannot read is an error: a missing `from`, `to`, `signal` or `method` ends the
 * whole load (`resource_format_text.cpp:311-333`). One that names no node is a warning: the scene loads and the
 * instantiate skips the connection (`packed_scene.cpp:660-662`).
 */

import { describe, expect, it } from 'vitest';
import { expectNoDiagnostic, instanced, lint, node, packedScene, scene } from './testing/testkit.js';
import './index.js';

const MISSING_FIELD = 'connection-missing-field';
const MISSING_NODE = 'connection-node-missing';

const FIELDS = { signal: 'ready', from: 'Button', to: '.', method: '_on_ready' } as const;

/** A scene with a root, a `Button` child and `Button/Deeper`, then the given `[connection]` headings. */
function sceneWith(...connections: string[]): string {
  return scene(
    node('Node', {}, { name: 'Root' }),
    node('Button', {}, { name: 'Button', parent: '.' }),
    node('Control', {}, { name: 'Deeper', parent: 'Button' }),
    ...connections
  );
}

/** A `[connection]` heading with every field of {@link FIELDS} except those overridden, and none for `undefined`. */
function connection(
  overrides: Partial<Record<keyof typeof FIELDS | 'from_uid_path' | 'to_uid_path', string>> = {}
) {
  const fields = { ...FIELDS, ...overrides };
  const written = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}="${value}"`);
  return `[connection ${written.join(' ')}]`;
}

const withoutField = (field: keyof typeof FIELDS) =>
  connection({ [field]: undefined } as Partial<Record<keyof typeof FIELDS, string>>);

const named = (source: string, ruleName: string) => lint(source).filter((d) => d.ruleName === ruleName);

describe('a connection heading with a missing field', () => {
  it.each(['from', 'to', 'signal', 'method'] as const)(
    'errors once on the line of a heading with no %s',
    (field) => {
      const reports = named(sceneWith(withoutField(field)), MISSING_FIELD);
      expect(reports).toHaveLength(1);
      expect(reports[0]).toBeAtTier('error');
      expect(reports[0]?.message).toContain(`'${field}'`);
      expect(reports[0]?.location?.line).toBe(9);
    }
  );

  it('names every missing field on one heading in one report', () => {
    const reports = named(sceneWith('[connection signal="ready"]'), MISSING_FIELD);
    expect(reports).toHaveLength(1);
    for (const field of ['from', 'to', 'method']) expect(reports[0]?.message).toContain(`'${field}'`);
  });

  it('reports nothing for a heading that states all four', () => {
    expect(named(sceneWith(connection()), MISSING_FIELD)).toEqual([]);
  });
});

describe('a connection end that names no node', () => {
  it.each([
    ['from', connection({ from: 'Missing' })],
    ['to', connection({ to: 'Nope/Deeper' })],
  ])('warns once on a %s that resolves nowhere', (_end, heading) => {
    const reports = named(sceneWith(heading), MISSING_NODE);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toBeAtTier('warning');
    expect(reports[0]?.location?.line).toBe(9);
  });

  it('warns for an empty path, which get_node_or_null answers with null', () => {
    expect(named(sceneWith(connection({ from: '' })), MISSING_NODE)).toHaveLength(1);
  });

  it('reports both ends of one heading', () => {
    expect(named(sceneWith(connection({ from: 'Gone', to: 'Nope' })), MISSING_NODE)).toHaveLength(2);
  });

  it('stays silent for the root, a nested node and a simplified path', () => {
    const source = sceneWith(
      connection({ from: '.', to: 'Button/Deeper' }),
      connection({ from: './Button/Deeper/..', to: 'Button' })
    );
    expect(named(source, MISSING_NODE)).toEqual([]);
  });

  it('stays silent for a path into the children of an instanced node', () => {
    const source = scene(
      packedScene,
      node('Node', {}, { name: 'Root' }),
      instanced('Body', { parent: '.' }),
      connection({ from: 'Body/Inner' })
    );
    expect(named(source, MISSING_NODE)).toEqual([]);
  });

  it('stays silent for an absolute path', () => {
    expect(named(sceneWith(connection({ from: '/root/Elsewhere' })), MISSING_NODE)).toEqual([]);
  });

  it('stays silent for a path above the root', () => {
    expect(named(sceneWith(connection({ to: '..' })), MISSING_NODE)).toEqual([]);
  });

  it('stays silent for a unique name this file claims', () => {
    const source = scene(
      node('Node', {}, { name: 'Root' }),
      node('Button', { unique_name_in_owner: true }, { name: 'Ok', parent: '.' }),
      connection({ from: '%Ok' })
    );
    expect(named(source, MISSING_NODE)).toEqual([]);
  });

  it('stays silent for a missing path that carries its uid path', () => {
    const source = sceneWith(connection({ from: 'Gone', from_uid_path: 'PackedInt32Array(1)' }));
    expectNoDiagnostic(source, { ruleName: MISSING_NODE });
  });

  it('warns for an end whose own uid path is absent, though the other end carries one', () => {
    const source = sceneWith(connection({ from: 'Gone', to: 'Nope', from_uid_path: 'PackedInt32Array(1)' }));
    expect(named(source, MISSING_NODE)).toHaveLength(1);
  });

  it('stays silent when the file has no node to resolve from', () => {
    expect(named(scene(connection({ from: 'Gone' })), MISSING_NODE)).toEqual([]);
  });
});
