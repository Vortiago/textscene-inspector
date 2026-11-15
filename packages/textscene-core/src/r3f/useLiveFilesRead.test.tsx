/**
 * A read on the live files requests its file once, however many commits read it while it loads. A
 * new read of the same file keeps the shared snapshot, and a read of another file starts a new one.
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
import { liveFilesOf } from './liveFiles';

const A_FILE = 'res://a.tres';
const B_FILE = 'res://b.tres';
const SCENE = sceneTables(
  `[ext_resource type="Resource" path="${A_FILE}" id="1_a"]\n[ext_resource type="Resource" path="${B_FILE}" id="1_b"]`
);
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

/** A reader of the file `id` names, with a new read closure on each new `commit`. */
function ReaderOf({ id, commit }: { id: string; commit: number }) {
  const read = useCallback(
    (snapshot: ResourceSnapshot) => snapshot.read(nodeReference(`ExtResource("${id}")`, SCENE), kind),
    // `commit` gives each commit a new closure over the same inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, commit]
  );
  useLiveFilesRead(read, Object.is);
  return null;
}

/** The live files of a loader over both files, loaded, and the element that reads `id` at `commit`. */
async function loadedFiles() {
  const { bus, provider } = busServing({
    [A_FILE]: resourceFile('resource_name = "a"'),
    [B_FILE]: resourceFile('resource_name = "b"'),
  });
  const loader = new ResourceLoader(bus);
  loader.setProvider(provider);
  const at = (id: string, commit: number) => (
    <ResourceLoaderProvider loader={loader}>
      <ReaderOf id={id} commit={commit} />
    </ResourceLoaderProvider>
  );
  return { liveFiles: liveFilesOf(loader), at };
}

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve)));

describe('useLiveFilesRead', () => {
  it('keeps the shared snapshot for a new read of the same file', async () => {
    const { liveFiles, at } = await loadedFiles();
    const { rerender } = render(at('1_a', 1));
    await settle();
    await settle();
    const snapshot = liveFiles.current();

    await act(async () => rerender(at('1_a', 2)));
    await settle();

    expect(liveFiles.current()).toBe(snapshot);
  });

  it('reports no change for a new read of a file already reported', async () => {
    const { liveFiles, at } = await loadedFiles();
    const { rerender } = render(at('1_a', 1));
    await settle();
    await settle();
    const version = liveFiles.filesVersion();

    await act(async () => rerender(at('1_a', 2)));
    await settle();

    expect(liveFiles.filesVersion()).toBe(version);
  });

  it('drops a file from the report once the reader reads another', async () => {
    const { liveFiles, at } = await loadedFiles();
    const { rerender } = render(at('1_a', 1));
    await settle();

    await act(async () => rerender(at('1_b', 1)));
    await settle();

    expect([...liveFiles.files().keys()]).toEqual([B_FILE]);
  });

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
