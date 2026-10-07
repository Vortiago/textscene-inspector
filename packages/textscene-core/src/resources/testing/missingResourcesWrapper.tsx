/** A test wrapper that mounts the missing-resources panel state over a resource loader. */
import type { ReactNode } from 'react';
import { MissingResourcesProvider } from '../../r3f/contexts/MissingResourcesContext';
import { ResourceLoaderProvider } from '../ResourceLoaderContext';
import type { ResourceLoader } from '../ResourceLoader';

export function missingResourcesWrapper(loader: ResourceLoader) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MissingResourcesProvider>
        <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>
      </MissingResourcesProvider>
    );
  };
}
