/**
 * The hook host passes the host conformance suite: a component that reads its node's property
 * through `useNodeResource`, under a real loader over a map of files.
 */

import { act, render } from '@testing-library/react';
import { SceneResourcesProvider, type SceneResources } from '../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../ResourceLoaderContext';
import type { ResourceLoader } from '../ResourceLoader';
import type { Read, ResourceKind } from './read';
import type { Named } from './reading.testkit';
import { describeSnapshotHost, type SnapshotHostHarness } from './snapshotHost.testkit';
import { useNodeResource } from './useNodeResource';

interface ReaderProps {
  readonly reference: string;
  readonly kind: ResourceKind<Named>;
  readonly onRender: (read: Read<Named>) => void;
}

function Reader({ reference, kind, onRender }: ReaderProps) {
  onRender(useNodeResource(reference, kind));
  return null;
}

/** Enough timer ticks for a file read through the bus, and the render it starts, to finish. */
const SETTLE_TICKS = 5;

function hookHost(loader: ResourceLoader): SnapshotHostHarness {
  const runs: Read<Named>[] = [];
  const onRender = (read: Read<Named>) => runs.push(read);
  const tree = (reference: string, scene: SceneResources, kind: ResourceKind<Named>) => (
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider {...scene}>
        <Reader reference={reference} kind={kind} onRender={onRender} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  let rendered: ReturnType<typeof render> | null = null;
  return {
    run(reference, scene, kind) {
      act(() => {
        if (rendered) rendered.rerender(tree(reference, scene, kind));
        else rendered = render(tree(reference, scene, kind));
      });
    },
    runs: () => runs,
    async settle() {
      for (let tick = 0; tick < SETTLE_TICKS; tick++) {
        await act(() => new Promise<void>((resolve) => setTimeout(resolve)));
      }
    },
  };
}

describeSnapshotHost('the hook host', hookHost);
