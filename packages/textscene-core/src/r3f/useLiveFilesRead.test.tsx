/**
 * A read on the live files requests its file once, however many commits read it while it loads.
 */
import { describe, expect, it } from 'vitest';
import { useCallback } from 'react';
import { act, render } from '@testing-library/react';
import { ResourceLoader } from '../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { busServing } from '../resources/testing/servingFileBus';
import type { ResourceSnapshot } from '../resources/reading/read';
import { nodeReference } from '../resources/reading/scopedReference';
import { namedKind, resourceFile, sceneTables } from '../resources/reading/reading.testkit';
import { useLiveFilesRead } from './useLiveSceneTree';

const A_FILE = 'res://a.tres';
const SCENE = sceneTables(`[ext_resource type="Resource" path="${A_FILE}" id="1_a"]`);
const { kind } = namedKind();

/** A reader of `a.tres` that renders again for each new `commit`. */
function Reader({ commit }: { commit: number }) {
  const read = useCallback(
    (snapshot: ResourceSnapshot) => snapshot.read(nodeReference('ExtResource("1_a")', SCENE), kind),
    []
  );
  useLiveFilesRead(read, Object.is);
  return <>{commit}</>;
}

describe('useLiveFilesRead', () => {
  it('requests a file once for the same read on three commits in a row', async () => {
    const { bus, provider, loads } = busServing({ [A_FILE]: resourceFile('resource_name = "a"') }, [A_FILE]);
    const loader = new ResourceLoader(bus);
    loader.setProvider(provider);
    const at = (commit: number) => (
      <ResourceLoaderProvider loader={loader}>
        <Reader commit={commit} />
      </ResourceLoaderProvider>
    );

    const { rerender } = render(at(1));
    for (const commit of [2, 3]) {
      await act(async () => rerender(at(commit)));
    }
    await act(() => new Promise<void>((resolve) => setTimeout(resolve)));

    expect(loads).toEqual([A_FILE]);
  });
});
