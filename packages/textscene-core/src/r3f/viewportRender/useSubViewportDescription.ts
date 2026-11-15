import { useMemo } from 'react';
import { useByValue } from '../hooks/useByValue.js';
import { sameData } from '../../utils/sameData.js';
import type { SubViewportProperties } from '../../nodes/viewport/subviewport/types.js';
import { useRootViewportDescription } from './useRootViewportDescription.js';
import { subViewportDescription, type ViewportDescription } from './viewportDescription.js';

/** The node's description, the same object while its facts and the root's hold. */
export function useSubViewportDescription(properties: SubViewportProperties): ViewportDescription {
  const root = useRootViewportDescription();
  return useByValue(
    useMemo(() => subViewportDescription(properties, root), [properties, root]),
    sameData
  );
}
