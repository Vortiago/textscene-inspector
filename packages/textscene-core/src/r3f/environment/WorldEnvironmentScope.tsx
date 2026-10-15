/**
 * The Environment each world draws with. Godot's World3D takes the Environment of the first
 * WorldEnvironment in its group, which only a node with a valid Environment joins
 * (`world_environment.cpp:40-41`, `:77-83`). Each WorldEnvironment publishes what its reference
 * resolves to, and one chooser per world applies the winner (ADR-0025).
 */

import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { EnvironmentLayer, type EnvironmentLayerProps } from './EnvironmentLayer';
import { NoEnvironmentLayer } from './NoEnvironmentLayer';
import { PreviewEnvironment } from '../preview/PreviewEnvironment';
import { usePreviewYield } from '../preview/usePreviewYield';
import { compareTreeOrder, useTreeOrder, type TreeOrder } from '../contexts/TreeOrderContext';

/**
 * What a WorldEnvironment's `environment` resolves to. `none` is no reference, a `.tres` that
 * failed to load or a resource of another type: Godot holds no valid Environment for any of them.
 */
export type EnvironmentResolution =
  { status: 'pending' } | { status: 'none' } | { status: 'resolved'; environment: EnvironmentLayerProps };

/** The one `pending` and `none` value, so an unchanged resolution publishes nothing. */
export const PENDING_ENVIRONMENT: EnvironmentResolution = { status: 'pending' };
export const NO_ENVIRONMENT: EnvironmentResolution = { status: 'none' };

interface Publication {
  key: object;
  order: TreeOrder;
  resolution: EnvironmentResolution;
}

interface Publisher {
  publish(publication: Publication): void;
  withdraw(key: object): void;
}

const PublisherContext = createContext<Publisher | null>(null);
const PublicationsContext = createContext<readonly Publication[]>([]);

/**
 * The publications of one world, in tree order: Godot's group sorts its nodes so, an ancestor
 * first (`scene_tree.cpp:1568-1581`). React's mount order differs for a sub-scene that loads late
 * and for a child, whose effects run before its parent's.
 */
function WorldEnvironmentRegistry({ children }: { children: ReactNode }) {
  const [publications, setPublications] = useState<readonly Publication[]>([]);
  const publisher = useMemo(
    (): Publisher => ({
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

/** Puts a WorldEnvironment's resolution in its world. Layout effects, so the chooser updates before paint. */
export function usePublishEnvironment(resolution: EnvironmentResolution): void {
  const publisher = useContext(PublisherContext);
  if (!publisher) throw new Error('expected a world environment scope above a WorldEnvironment, found none');
  const [key] = useState(() => ({}));
  const order = useTreeOrder();
  useLayoutEffect(() => () => publisher.withdraw(key), [publisher, key]);
  useLayoutEffect(() => publisher.publish({ key, order, resolution }), [publisher, key, order, resolution]);
}

function isSamePublication(a: Publication, b: Publication): boolean {
  return a.resolution === b.resolution && compareTreeOrder(a.order, b.order) === 0;
}

/** The world's Environment: null with no WorldEnvironment, `none` when none holds a valid one. */
function useWorldEnvironment(): EnvironmentResolution | null {
  const publications = useContext(PublicationsContext);
  return useMemo(() => {
    if (publications.length === 0) return null;
    return publications.find((entry) => entry.resolution.status !== 'none')?.resolution ?? NO_ENVIRONMENT;
  }, [publications]);
}

/** The root viewport's world, which falls back to the editor preview environment. */
export function RootEnvironmentScope({ children }: { children: ReactNode }) {
  return (
    <WorldEnvironmentRegistry>
      <RootEnvironment />
      {children}
    </WorldEnvironmentRegistry>
  );
}

function RootEnvironment() {
  const authored = useWorldEnvironment();
  const showsPreview = usePreviewYield().environment;
  if (authored?.status === 'resolved') return <EnvironmentLayer {...authored.environment} />;
  if (authored?.status === 'pending') return null;
  // A publication proves a WorldEnvironment node, which takes the preview away by type.
  return !authored && showsPreview ? <PreviewEnvironment /> : <NoEnvironmentLayer />;
}

/**
 * A sub-viewport's portal world. Its pass sets its own clear colour, so only a resolved Environment
 * adds a layer here, and a missing one leaves the root's clear colour alone.
 */
export function ViewportEnvironmentScope({ children }: { children: ReactNode }) {
  return (
    <WorldEnvironmentRegistry>
      <ViewportEnvironment />
      {children}
    </WorldEnvironmentRegistry>
  );
}

function ViewportEnvironment() {
  const authored = useWorldEnvironment();
  return authored?.status === 'resolved' ? <EnvironmentLayer {...authored.environment} /> : null;
}
