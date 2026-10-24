/**
 * A group of one viewport's WorldEnvironments, as Godot's World3D keeps it: the WorldEnvironments
 * inside publish to it, and its chooser answers the first one in tree order that holds a valid
 * resource (`world_environment.cpp:43-48`, `:87-93`). Godot keeps a group per resource slot, so the
 * Environment and the CameraAttributes each choose their node apart (ADR-0025).
 */

import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { compareTreeOrder, useTreeOrder, type TreeOrder } from '../contexts/TreeOrderContext';

/**
 * What a WorldEnvironment's slot resolves to. `none` is no reference, a `.tres` that failed to load
 * or a resource of another type: Godot holds no valid resource for any of them.
 */
export interface Resolution {
  status: 'pending' | 'none' | 'resolved';
}

interface Publication<R extends Resolution> {
  key: object;
  order: TreeOrder;
  resolution: R;
}

interface Publisher<R extends Resolution> {
  publish(publication: Publication<R>): void;
  withdraw(key: object): void;
}

export interface WorldGroup<R extends Resolution> {
  /** Holds the publications of the world below it. One per world, above every reader. */
  Provider: (props: { children: ReactNode }) => ReactNode;
  /** Puts a WorldEnvironment's resolution in its world. Layout effects, so the chooser updates before paint. */
  usePublish: (resolution: R) => void;
  /** The world's resolution: null with no WorldEnvironment, `none` when none holds a valid one. */
  useChosen: () => R | null;
}

/**
 * `none` is the one value an absent slot publishes, so an unchanged resolution publishes nothing.
 * A `pending` publication holds its place, since its resource may turn out valid.
 */
export function createWorldGroup<R extends Resolution>(none: R): WorldGroup<R> {
  const PublisherContext = createContext<Publisher<R> | null>(null);
  const PublicationsContext = createContext<readonly Publication<R>[]>([]);

  /**
   * The publications sort in tree order, as Godot's group sorts its nodes, an ancestor first
   * (`scene_tree.cpp:1568-1581`). React's mount order differs for a late sub-scene and for a child.
   */
  function Provider({ children }: { children: ReactNode }) {
    const [publications, setPublications] = useState<readonly Publication<R>[]>([]);
    const publisher = useMemo(
      (): Publisher<R> => ({
        publish: (publication) =>
          setPublications((current) => {
            const previous = current.find((entry) => entry.key === publication.key);
            if (previous && isSamePublication(previous, publication)) return current;
            const next = previous
              ? current.map((entry) => (entry === previous ? publication : entry))
              : [...current, publication];
            return next.sort((a, b) => compareTreeOrder(a.order, b.order));
          }),
        withdraw: (key) => setPublications((current) => current.filter((entry) => entry.key !== key)),
      }),
      []
    );
    return (
      <PublisherContext.Provider value={publisher}>
        <PublicationsContext.Provider value={publications}>{children}</PublicationsContext.Provider>
      </PublisherContext.Provider>
    );
  }

  function usePublish(resolution: R): void {
    const publisher = useContext(PublisherContext);
    if (!publisher)
      throw new Error('expected a world environment scope above a WorldEnvironment, found none');
    const [key] = useState(() => ({}));
    const order = useTreeOrder();
    useLayoutEffect(() => () => publisher.withdraw(key), [publisher, key]);
    useLayoutEffect(() => publisher.publish({ key, order, resolution }), [publisher, key, order, resolution]);
  }

  function useChosen(): R | null {
    const publications = useContext(PublicationsContext);
    return useMemo(() => {
      if (publications.length === 0) return null;
      return publications.find((entry) => entry.resolution.status !== 'none')?.resolution ?? none;
    }, [publications]);
  }

  return { Provider, usePublish, useChosen };
}

function isSamePublication<R extends Resolution>(a: Publication<R>, b: Publication<R>): boolean {
  return a.resolution === b.resolution && compareTreeOrder(a.order, b.order) === 0;
}
