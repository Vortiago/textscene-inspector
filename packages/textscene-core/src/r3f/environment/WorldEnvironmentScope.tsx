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

/**
 * What a WorldEnvironment's `environment` resolves to. `none` is no reference, a `.tres` that
 * failed to load or a resource of another type: Godot holds no valid Environment for any of them.
 */
export type EnvironmentResolution =
  { status: 'pending' } | { status: 'none' } | { status: 'resolved'; environment: EnvironmentLayerProps };

const NONE: EnvironmentResolution = { status: 'none' };

interface Publication {
  key: object;
  resolution: EnvironmentResolution;
}

interface Publisher {
  publish(key: object, resolution: EnvironmentResolution): void;
  withdraw(key: object): void;
}

const PublisherContext = createContext<Publisher | null>(null);
const PublicationsContext = createContext<readonly Publication[]>([]);

/**
 * The publications of one world, in mount order: the tree order Godot's group keeps. A changed
 * resolution keeps its place, so the first WorldEnvironment stays first while its `.tres` loads.
 */
function WorldEnvironmentRegistry({ children }: { children: ReactNode }) {
  const [publications, setPublications] = useState<readonly Publication[]>([]);
  const publisher = useMemo(
    (): Publisher => ({
      publish: (key, resolution) =>
        setPublications((current) => {
          const index = current.findIndex((entry) => entry.key === key);
          if (index < 0) return [...current, { key, resolution }];
          if (current[index]!.resolution === resolution) return current;
          return current.map((entry, i) => (i === index ? { key, resolution } : entry));
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
  useLayoutEffect(() => () => publisher.withdraw(key), [publisher, key]);
  useLayoutEffect(() => publisher.publish(key, resolution), [publisher, key, resolution]);
}

/** The world's Environment: null with no WorldEnvironment, `none` when none holds a valid one. */
function useWorldEnvironment(): EnvironmentResolution | null {
  const publications = useContext(PublicationsContext);
  return useMemo(() => {
    if (publications.length === 0) return null;
    return publications.find((entry) => entry.resolution.status !== 'none')?.resolution ?? NONE;
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
 * A sub-viewport's portal world. Its pass sets its own clear colour and tonemap, so only a resolved
 * Environment adds a layer here, and a missing one leaves the root's clear colour alone.
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
