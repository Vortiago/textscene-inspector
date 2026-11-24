/**
 * The Control solve's host passes the host conformance suite: the solve runs `buildForest` through
 * `useSnapshotHost`, so a reader run the same way, under a real loader over a map of files, is the
 * solve as its host sees it.
 */

import { useCallback } from 'react';
import { act, render } from '@testing-library/react';
import type { SceneResources } from '../../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import type { Read, ResourceKind } from '../../../resources/reading/read';
import type { Named } from '../../../resources/reading/reading.testkit';
import { nodeReference } from '../../../resources/reading/scopedReference';
import {
  describeSnapshotHost,
  type SnapshotHostHarness,
} from '../../../resources/reading/snapshotHost.testkit';
import { useSnapshotHost } from '../../../resources/reading/useNodeResource';

interface ReaderProps {
  readonly reference: string;
  readonly scene: SceneResources;
  readonly kind: ResourceKind<Named>;
  readonly onRun: (read: Read<Named>) => void;
}

/** A solve that reads one property: it runs its read once for each snapshot the host gives it. */
function Solve({ reference, scene, kind, onRun }: ReaderProps) {
  useSnapshotHost(
    useCallback(
      (snapshot) => {
        const read = snapshot.read(nodeReference(reference, scene), kind);
        onRun(read);
        return read;
      },
      [reference, scene, kind, onRun]
    )
  );
  return null;
}

/** Enough timer ticks for a file read through the bus, and the run it starts, to finish. */
const SETTLE_TICKS = 5;

function solveHost(loader: ResourceLoader): SnapshotHostHarness {
  const runs: Read<Named>[] = [];
  const onRun = (read: Read<Named>) => runs.push(read);
  const tree = (reference: string, scene: SceneResources, kind: ResourceKind<Named>) => (
    <ResourceLoaderProvider loader={loader}>
      <Solve reference={reference} scene={scene} kind={kind} onRun={onRun} />
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

describeSnapshotHost('the Control solve host', solveHost);
