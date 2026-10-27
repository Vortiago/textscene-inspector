/**
 * What one viewport's world gathers from the nodes inside it, as Godot's World3D keeps it. A
 * publication set holds every node's value in tree order. A group is a set of WorldEnvironment
 * resolutions whose chooser answers the first one in tree order that holds a valid resource
 * (`world_environment.cpp:43-48`, `:87-93`). Godot keeps a group per resource slot, so the
 * Environment and the CameraAttributes each choose their node apart (ADR-0025).
 */

import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { compareTreeOrder, useTreeOrder, type TreeOrder } from '../contexts/TreeOrderContext';

/**
 * What a WorldEnvironment's slot resolves to. `none` is no reference, a `.tres` that failed to load
 * or a resource of another type: Godot holds no valid resource for any of them. `Resolved` is what
 * a valid one adds.
 */
export type WorldResolution<Resolved extends object> =
  { status: 'pending' } | { status: 'none' } | ({ status: 'resolved' } & Resolved);

/** The one `pending` and `none` value of every slot, so an unchanged resolution publishes nothing. */
export const PENDING_RESOLUTION: { status: 'pending' } = { status: 'pending' };
export const NO_RESOLUTION: { status: 'none' } = { status: 'none' };

interface Publication<T> {
  key: object;
  order: TreeOrder;
  value: T;
}

interface Publisher<T> {
  publish(publication: Publication<T>): void;
  withdraw(key: object): void;
}

export interface WorldPublications<T> {
  /** Holds the publications of the world below it. One per world, above every reader. */
  Provider: (props: { children: ReactNode }) => ReactNode;
  /** Puts a node's value in its world. Layout effects, so the readers update before paint. */
  usePublish: (value: T) => void;
  /** Like `usePublish`, for a node that may stand outside any world: it publishes nowhere then. */
  usePublishIfInWorld: (value: T) => void;
  /** Every value of the world in tree order, an ancestor first. A new array when one changes. */
  useAll: () => readonly T[];
}

/**
 * The publications sort in tree order, as Godot's group sorts its nodes, an ancestor first
 * (`scene_tree.cpp:1568-1581`). React's mount order differs for a late sub-scene and for a child.
 */
export function createWorldPublications<T>(): WorldPublications<T> {
  const PublisherContext = createContext<Publisher<T> | null>(null);
  const PublicationsContext = createContext<readonly Publication<T>[]>([]);

  function Provider({ children }: { children: ReactNode }) {
    const [publications, setPublications] = useState<readonly Publication<T>[]>([]);
    const publisher = useMemo(
      (): Publisher<T> => ({
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

  function usePublishTo(publisher: Publisher<T> | null, value: T): void {
    const [key] = useState(() => ({}));
    const order = useTreeOrder();
    useLayoutEffect(() => (publisher ? () => publisher.withdraw(key) : undefined), [publisher, key]);
    useLayoutEffect(() => publisher?.publish({ key, order, value }), [publisher, key, order, value]);
  }

  function usePublish(value: T): void {
    const publisher = useContext(PublisherContext);
    if (!publisher)
      throw new Error('expected a world environment scope above the publishing node, found none');
    usePublishTo(publisher, value);
  }

  function usePublishIfInWorld(value: T): void {
    usePublishTo(useContext(PublisherContext), value);
  }

  function useAll(): readonly T[] {
    const publications = useContext(PublicationsContext);
    return useMemo(() => publications.map((entry) => entry.value), [publications]);
  }

  return { Provider, usePublish, usePublishIfInWorld, useAll };
}

function isSamePublication<T>(a: Publication<T>, b: Publication<T>): boolean {
  return a.value === b.value && compareTreeOrder(a.order, b.order) === 0;
}

export interface WorldGroup<R extends { status: string }> {
  Provider: WorldPublications<R>['Provider'];
  /** Puts a WorldEnvironment's resolution in its world. */
  usePublish: WorldPublications<R>['usePublish'];
  /** The world's resolution: null with no WorldEnvironment, `none` when none holds a valid one. */
  useChosen: () => R | null;
}

/** A `pending` publication holds its place, since its resource may turn out valid. */
export function createWorldGroup<Resolved extends object>(): WorldGroup<WorldResolution<Resolved>> {
  type R = WorldResolution<Resolved>;
  const { Provider, usePublish, useAll } = createWorldPublications<R>();

  function useChosen(): R | null {
    const resolutions = useAll();
    return useMemo(() => {
      if (resolutions.length === 0) return null;
      return resolutions.find((resolution) => resolution.status !== 'none') ?? NO_RESOLUTION;
    }, [resolutions]);
  }

  return { Provider, usePublish, useChosen };
}
