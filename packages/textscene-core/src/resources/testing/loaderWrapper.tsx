import type { ReactNode } from 'react';
import { ResourceLoaderProvider } from '../ResourceLoaderContext';
import type { ResourceLoader } from '../ResourceLoader';

export function loaderWrapper(loader: ResourceLoader) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>;
  };
}
