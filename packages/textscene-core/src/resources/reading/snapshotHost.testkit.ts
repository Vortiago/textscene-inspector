/**
 * The conformance suite of a snapshot host: code that owns snapshots for a reader, requests and
 * pins the files its reads touched, runs it again when one of them changes, and reports a failed
 * file once, and an address that a loaded file does not declare. The hook host passes it, and so must each later host (the Control solve, the live
 * scene tree).
 */

import { describe, expect, it } from 'vitest';
import { ResourceLoader } from '../ResourceLoader';
import { busServing } from '../testing/servingFileBus';
import type { SceneResources } from '../../r3f/SceneResourcesContext';
import type { Read, ResourceKind } from './read';
import { namedKind, resourceFile, sceneTables, type Named } from './reading.testkit';

/** A host as the suite drives it, over the loader the suite hands it. */
export interface SnapshotHostHarness {
  /**
   * Starts a reader of `ref`, a property of a node in a scene with `scene`'s tables, or replaces
   * it, and runs it as the host runs its readers.
   */
  run(ref: string, scene: SceneResources, kind: ResourceKind<Named>): void;
  /** Every answer the reader gave, in the order the host ran it. */
  runs(): readonly Read<Named>[];
  /** The paths the host reports as a **Missing resource** now. */
  reported(): readonly string[];
  /** Lets the loads and runs the host started finish. */
  settle(): Promise<void>;
}

const A_FILE = 'res://a.tres';
const B_FILE = 'res://b.tres';
const EXT_A = `[ext_resource type="Resource" path="${A_FILE}" id="1_a"]`;

/** A loader over `files`, with the paths the provider was asked for. */
function servedLoader(files: Record<string, string>) {
  const { bus, provider, loads } = busServing(files);
  const loader = new ResourceLoader(bus);
  loader.setProvider(provider);
  return { loader, requested: () => loads };
}

function nameOf(read: Read<Named> | undefined): string | null {
  return read?.status === 'loaded' ? read.value.name : null;
}

export function describeSnapshotHost(
  name: string,
  makeHost: (loader: ResourceLoader) => SnapshotHostHarness
) {
  describe(`${name} as a snapshot host`, () => {
    it('answers a SubResource loaded, with no request', async () => {
      const { loader, requested } = servedLoader({});
      const host = makeHost(loader);

      const scene = sceneTables('[sub_resource type="Resource" id="r"]\nresource_name = "inline"');

      host.run('SubResource("r")', scene, namedKind().kind);
      await host.settle();

      expect(host.runs().map(nameOf)).toEqual(['inline']);
      expect(requested()).toEqual([]);
    });

    it('answers an ExtResource pending, requests its file once, and runs once more to loaded', async () => {
      const { loader, requested } = servedLoader({ [A_FILE]: resourceFile('resource_name = "from a"') });
      const host = makeHost(loader);

      host.run('ExtResource("1_a")', sceneTables(EXT_A), namedKind().kind);
      await host.settle();

      expect(host.runs().map((read) => read.status)).toEqual(['pending', 'loaded']);
      expect(nameOf(host.runs().at(-1))).toBe('from a');
      expect(requested()).toEqual([A_FILE]);
    });

    it('runs nothing for the load of a file the reader did not read', async () => {
      const { loader } = servedLoader({ [B_FILE]: resourceFile('') });
      const host = makeHost(loader);
      host.run('SubResource("r")', sceneTables('[sub_resource type="Resource" id="r"]'), namedKind().kind);
      await host.settle();

      loader.resources.request(B_FILE);
      await host.settle();

      expect(host.runs()).toHaveLength(1);
    });

    it('answers missing-file for a failed file, and reports one Missing resource', async () => {
      const { loader } = servedLoader({});
      const host = makeHost(loader);

      host.run('ExtResource("1_a")', sceneTables(EXT_A), namedKind().kind);
      await host.settle();

      expect(host.runs().at(-1)).toMatchObject({ status: 'unavailable', reason: 'missing-file' });
      expect(host.reported()).toEqual([A_FILE]);
    });

    it('answers unknown-id for an address the loaded file does not declare, and reports the address', async () => {
      const { loader } = servedLoader({ [A_FILE]: resourceFile('') });
      const host = makeHost(loader);
      const address = `${A_FILE}::gone`;
      const ext = `[ext_resource type="Resource" path="${address}" id="1_gone"]`;

      host.run('ExtResource("1_gone")', sceneTables(ext), namedKind().kind);
      await host.settle();

      expect(host.runs().at(-1)).toMatchObject({ status: 'unavailable', reason: 'unknown-id' });
      expect(host.reported()).toEqual([address]);
    });

    it('reports no Missing resource for a failed file the reader stopped reading', async () => {
      const { loader } = servedLoader({});
      const host = makeHost(loader);
      host.run('ExtResource("1_a")', sceneTables(EXT_A), namedKind().kind);
      await host.settle();

      host.run('SubResource("r")', sceneTables('[sub_resource type="Resource" id="r"]'), namedKind().kind);
      await host.settle();

      expect(host.reported()).toEqual([]);
    });

    it('requests the second file of a nested reference once the first arrives', async () => {
      const { loader, requested } = servedLoader({
        [A_FILE]: resourceFile(
          'next = ExtResource("1_b")',
          `[ext_resource type="Resource" path="${B_FILE}" id="1_b"]`
        ),
        [B_FILE]: resourceFile('resource_name = "from b"'),
      });
      const host = makeHost(loader);

      host.run('ExtResource("1_a")', sceneTables(EXT_A), namedKind().kind);
      await host.settle();

      const outer = host.runs().at(-1);
      expect(outer?.status === 'loaded' && nameOf(outer.value.next)).toBe('from b');
      expect(requested()).toEqual([A_FILE, B_FILE]);
    });

    it('answers the same value for a second parse of the scene with equal resource text', async () => {
      const { loader } = servedLoader({});
      const host = makeHost(loader);
      const { kind } = namedKind();
      const text = '[sub_resource type="Resource" id="r"]\nresource_name = "inline"';

      host.run('SubResource("r")', sceneTables(text), kind);
      await host.settle();
      host.run('SubResource("r")', sceneTables(text), kind);
      await host.settle();

      const [first, second] = host.runs();
      expect(second?.value).toBe(first?.value);
    });
  });
}
