/**
 * A `[connection]` heading the loader cannot read is an error: a missing `from`, `to`, `signal` or `method` ends the
 * whole load (`resource_format_text.cpp:311-333`). One that names no node is a warning: the scene loads and the
 * instantiate skips the connection (`packed_scene.cpp:660-662`).
 */

import { describe, expect, it } from 'vitest';
import { instanced, lint, node, packedScene, scene } from './testing/testkit.js';
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
function connection(overrides: Partial<Record<keyof typeof FIELDS, string>> = {}) {
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

  it('warns for an absolute path, which the root refuses off the tree', () => {
    // Instantiate resolves both ends from the root before it enters a tree (packed_scene.cpp:161, :656-657),
    // and `get_node_or_null` refuses an absolute path there (node.cpp:1898).
    expect(named(sceneWith(connection({ from: '/root/Elsewhere' })), MISSING_NODE)).toHaveLength(1);
  });

  it('warns for a path above the root, which has no parent at instantiate', () => {
    // node.cpp:1920-1921 returns null for `..` from a node with no parent.
    expect(named(sceneWith(connection({ to: '..' })), MISSING_NODE)).toHaveLength(1);
  });

  it('stays silent for a node seated inside an instanced node', () => {
    const source = scene(
      packedScene,
      node('Node', {}, { name: 'Root' }),
      instanced('Body', { parent: '.' }),
      node('Node', {}, { name: 'Added', parent: 'Body/Inner' }),
      connection({ from: 'Body/Inner/Added' })
    );
    expect(named(source, MISSING_NODE)).toEqual([]);
  });

  it('stays silent for a unique name an instanced root may claim', () => {
    const source = scene(packedScene, instanced('Root'), connection({ from: '%Elsewhere' }));
    expect(named(source, MISSING_NODE)).toEqual([]);
  });

  it('warns for a unique name only an override inside an instance claims', () => {
    // The override keeps the sub-scene's owner (resource_format_text.cpp:264-265), so the claim is not the root's.
    const source = scene(
      packedScene,
      node('Node', {}, { name: 'Root' }),
      instanced('Body', { parent: '.' }),
      `[node name="Part" parent="Body"]\nunique_name_in_owner = true`,
      connection({ from: '%Part' })
    );
    expect(named(source, MISSING_NODE)).toHaveLength(1);
  });

  it('stays silent for a unique name this file claims', () => {
    const source = scene(
      node('Node', {}, { name: 'Root' }),
      node('Button', { unique_name_in_owner: true }, { name: 'Ok', parent: '.' }),
      connection({ from: '%Ok' })
    );
    expect(named(source, MISSING_NODE)).toEqual([]);
  });

  it('stays silent for a path that walks only once simplified', () => {
    // The loader stores `from.simplified()` (resource_format_text.cpp:370), so `Gone` never reaches the walk.
    expect(named(sceneWith(connection({ from: 'Gone/../Button' })), MISSING_NODE)).toEqual([]);
  });
});

describe('a connection end that carries a uid path', () => {
  /** A root, a `Button` with `unique_id=7` and an instance `Body` with `unique_id=9`, then the headings. */
  const sceneWithIds = (...connections: string[]) =>
    scene(
      packedScene,
      node('Node', {}, { name: 'Root' }),
      '[node name="Button" type="Button" parent="." unique_id=7]',
      '[node name="Body" parent="." unique_id=9 instance=ExtResource("1_body")]',
      ...connections
    );
  const withTrail = (trail: string) =>
    `[connection signal="ready" from="Gone" to="." method="_on_ready" from_uid_path=PackedInt32Array(${trail})]`;

  it('stays silent when the first id names a heading in this file', () => {
    // A path that misses falls back to the id trail (packed_scene.cpp:161-163, :1947-2005).
    expect(named(sceneWithIds(withTrail('7')), MISSING_NODE)).toEqual([]);
  });

  it('stays silent when the trail continues into an instanced scene', () => {
    expect(named(sceneWithIds(withTrail('9, 4')), MISSING_NODE)).toEqual([]);
  });

  it('warns when the trail names no heading', () => {
    expect(named(sceneWithIds(withTrail('99')), MISSING_NODE)).toHaveLength(1);
  });

  it('warns when the trail is empty', () => {
    expect(named(sceneWithIds(withTrail('')), MISSING_NODE)).toHaveLength(1);
  });

  it('warns when a middle id names a node that is no instance', () => {
    expect(named(sceneWithIds(withTrail('7, 4')), MISSING_NODE)).toHaveLength(1);
  });

  it('warns for an end whose own uid path is absent, though the other end carries one', () => {
    const heading =
      '[connection signal="ready" from="Gone" to="Nope" method="_on_ready" from_uid_path=PackedInt32Array(7)]';
    expect(named(sceneWithIds(heading), MISSING_NODE)).toHaveLength(1);
  });
});

describe('a connection in a file with no node', () => {
  it('stays silent when the file has no node to resolve from', () => {
    expect(named(scene(connection({ from: 'Gone' })), MISSING_NODE)).toEqual([]);
  });
});
