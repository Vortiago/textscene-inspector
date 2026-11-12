/**
 * The answers of a read, through a snapshot over a fixed map of files. Each case is one rule of
 * the read: what each answer means, the chain of holders, the cycle guard and the identity of a
 * decoded value.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../logger';
import { staticSnapshot } from './staticSnapshot.testkit';
import { nodeReference, referenceKey } from './scopedReference';
import { namedKind, resourceFile, sceneTables, type Named } from './reading.testkit';
import type { Read } from './read';

const A_FILE = 'res://a.tres';
const EXT_A = `[ext_resource type="Resource" path="${A_FILE}" id="1_a"]`;

function loadedValue(read: Read<Named>): Named {
  if (read.status !== 'loaded') throw new Error(`expected a loaded read, got ${read.status}`);
  return read.value;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a read through a snapshot', () => {
  it('answers a resource built into the scene, with no file to read', () => {
    const scene = sceneTables('[sub_resource type="Resource" id="r"]\nresource_name = "inline"');

    const read = staticSnapshot({}).read(nodeReference('SubResource("r")', scene), namedKind().kind);

    expect(loadedValue(read).name).toBe('inline');
  });

  it('answers a resource in a file the same as one built into the scene', () => {
    const scene = sceneTables(EXT_A);
    const files = { [A_FILE]: resourceFile('resource_name = "inline"') };

    const read = staticSnapshot(files).read(nodeReference('ExtResource("1_a")', scene), namedKind().kind);

    expect(loadedValue(read).name).toBe('inline');
  });

  it.each([undefined, '', 'null'])('answers none for a property that holds %j', (ref) => {
    const read = staticSnapshot({}).read(nodeReference(ref, sceneTables('')), namedKind().kind);

    expect(read.status).toBe('none');
  });

  it.each(['SubResource("gone")', 'ExtResource("gone")'])('answers unknown-id, not none, for %s', (ref) => {
    const read = staticSnapshot({}).read(nodeReference(ref, sceneTables('')), namedKind().kind);

    expect(read).toMatchObject({ status: 'unavailable', reason: 'unknown-id' });
  });

  it('answers missing-file for a file the map does not hold', () => {
    const read = staticSnapshot({}).read(
      nodeReference('ExtResource("1_a")', sceneTables(EXT_A)),
      namedKind().kind
    );

    expect(read).toMatchObject({ status: 'unavailable', reason: 'missing-file' });
  });

  it('answers wrong-type for a class the kind does not accept', () => {
    const scene = sceneTables('[sub_resource type="Curve" id="r"]');

    const read = staticSnapshot({}).read(nodeReference('SubResource("r")', scene), namedKind().kind);

    expect(read).toMatchObject({ status: 'unavailable', reason: 'wrong-type' });
  });

  it('answers undecodable for a decode that declines the resource', () => {
    const scene = sceneTables('[sub_resource type="Resource" id="r"]');

    const read = staticSnapshot({}).read(
      nodeReference('SubResource("r")', scene),
      namedKind(() => null).kind
    );

    expect(read).toMatchObject({ status: 'unavailable', reason: 'undecodable' });
  });

  it('answers undecodable for a decode that throws, and warns once for that resource', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const scene = sceneTables('[sub_resource type="Resource" id="r"]');
    const { kind } = namedKind(() => {
      throw new Error('bad value');
    });

    const reads = [1, 2].map(() => staticSnapshot({}).read(nodeReference('SubResource("r")', scene), kind));

    expect(reads).toEqual([1, 2].map(() => expect.objectContaining({ reason: 'undecodable' })));
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('a nested read', () => {
  it('resolves a reference in the tables of the file that holds it', () => {
    const files = {
      [A_FILE]: resourceFile(
        'resource_name = "outer"\nnext = SubResource("r")',
        '[sub_resource type="Resource" id="r"]\nresource_name = "in a.tres"'
      ),
    };
    const scene = sceneTables(
      `${EXT_A}\n\n[sub_resource type="Resource" id="r"]\nresource_name = "in the scene"`
    );

    const outer = loadedValue(
      staticSnapshot(files).read(nodeReference('ExtResource("1_a")', scene), namedKind().kind)
    );

    expect(loadedValue(outer.next).name).toBe('in a.tres');
  });

  it('turns isHeldLocally false at the first holder that is not local to scene, and keeps it false', () => {
    const scene = sceneTables(
      [
        '[sub_resource type="Resource" id="c"]',
        '[sub_resource type="Resource" id="b"]\nresource_local_to_scene = true\nnext = SubResource("c")',
        '[sub_resource type="Resource" id="a"]\nnext = SubResource("b")',
        '[sub_resource type="Resource" id="top"]\nresource_local_to_scene = true\nnext = SubResource("a")',
      ].join('\n\n')
    );

    const top = loadedValue(
      staticSnapshot({}).read(nodeReference('SubResource("top")', scene), namedKind().kind)
    );
    const a = loadedValue(top.next);
    const b = loadedValue(a.next);
    const c = loadedValue(b.next);

    expect([top, a, b, c].map((held) => held.isHeldLocally)).toEqual([true, true, false, false]);
  });

  it('answers cycle for a reference already on the way to it', () => {
    const scene = sceneTables(
      '[sub_resource type="Resource" id="b"]\nnext = SubResource("a")\n\n[sub_resource type="Resource" id="a"]\nnext = SubResource("b")'
    );

    const a = loadedValue(
      staticSnapshot({}).read(nodeReference('SubResource("a")', scene), namedKind().kind)
    );

    expect(loadedValue(a.next).next).toMatchObject({ status: 'unavailable', reason: 'cycle' });
  });

  it('reads one id in two files as two resources, not a cycle', () => {
    const files = {
      [A_FILE]: resourceFile(
        'next = SubResource("r")',
        '[sub_resource type="Resource" id="r"]\nresource_name = "in a.tres"'
      ),
    };
    const scene = sceneTables(`${EXT_A}\n\n[sub_resource type="Resource" id="r"]\nnext = ExtResource("1_a")`);

    const inScene = loadedValue(
      staticSnapshot(files).read(nodeReference('SubResource("r")', scene), namedKind().kind)
    );
    const inFile = loadedValue(loadedValue(inScene.next).next);

    expect(inFile.name).toBe('in a.tres');
  });

  it('hands on a reference that resolves in the holder’s tables, without reading it', () => {
    const files = {
      [A_FILE]: resourceFile('later = SubResource("r")', '[sub_resource type="Resource" id="r"]'),
    };
    const scene = sceneTables(EXT_A);
    const { kind, decodes } = namedKind();

    const outer = loadedValue(staticSnapshot(files).read(nodeReference('ExtResource("1_a")', scene), kind));

    expect(decodes()).toBe(1);
    expect(outer.later).toMatchObject({ ref: 'SubResource("r")', origin: A_FILE });
  });
});

describe('the key of a reference', () => {
  it('differs for one id in two files', () => {
    const scene = sceneTables('');
    const inScene = nodeReference('SubResource("r")', scene);
    const inFile = { ...inScene, origin: A_FILE };

    expect(referenceKey(inScene)).not.toBe(referenceKey(inFile));
  });
});

describe('the identity of a decoded value', () => {
  const RESOURCE = '[sub_resource type="Resource" id="r"]\nresource_name = "one"';

  it('is the same for two reads of one resource', () => {
    const scene = sceneTables(RESOURCE);
    const { kind } = namedKind();
    const read = () => staticSnapshot({}).read(nodeReference('SubResource("r")', scene), kind).value;

    expect(read()).toBe(read());
  });

  it('is the same for two reads of a file resource whose decode hands on a reference', () => {
    const files = {
      [A_FILE]: resourceFile('later = SubResource("r")', '[sub_resource type="Resource" id="r"]'),
    };
    const snapshot = staticSnapshot(files);
    const { kind } = namedKind();
    const read = () => snapshot.read(nodeReference('ExtResource("1_a")', sceneTables(EXT_A)), kind).value;

    expect(read()).toBe(read());
  });

  it('is the same across a new parse of the scene with equal text', () => {
    const { kind } = namedKind();
    const read = () =>
      staticSnapshot({}).read(nodeReference('SubResource("r")', sceneTables(RESOURCE)), kind).value;

    expect(read()).toBe(read());
  });

  it('is new once a property string changes', () => {
    const { kind } = namedKind();
    const read = (name: string) =>
      staticSnapshot({}).read(
        nodeReference(
          'SubResource("r")',
          sceneTables(`[sub_resource type="Resource" id="r"]\nresource_name = "${name}"`)
        ),
        kind
      ).value;

    expect(read('one')).not.toBe(read('two'));
  });

  it('is new once a nested answer changes', () => {
    const { kind } = namedKind();
    const read = (inner: string) =>
      staticSnapshot({}).read(
        nodeReference(
          'SubResource("outer")',
          sceneTables(
            `[sub_resource type="Resource" id="inner"]\nresource_name = "${inner}"\n\n[sub_resource type="Resource" id="outer"]\nnext = SubResource("inner")`
          )
        ),
        kind
      ).value;

    expect(read('one')).not.toBe(read('two'));
  });

  it('keeps one entry for a resource that 100 edits change, and keeps the value of another resource', () => {
    const { kind, decodes } = namedKind();
    const scene = (edit: number) =>
      sceneTables(
        `[sub_resource type="Resource" id="other"]\nresource_name = "other"\n\n[sub_resource type="Resource" id="r"]\nresource_name = "${edit}"`
      );
    const read = (id: string, edit: number) =>
      staticSnapshot({}).read(nodeReference(`SubResource("${id}")`, scene(edit)), kind).value;
    const other = read('other', 0);

    for (let edit = 0; edit < 100; edit++) read('r', edit);
    const beforeFirstText = decodes();
    read('r', 0);

    expect(decodes()).toBe(beforeFirstText + 1);
    expect(read('other', 100)).toBe(other);
  });
});
