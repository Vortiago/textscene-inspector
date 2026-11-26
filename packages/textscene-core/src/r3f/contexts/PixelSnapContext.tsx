import { createContext, useContext, type ReactNode } from 'react';
import { projectSnaps2DTransformsToPixel } from '../../parser/projectSettingsParser.js';
import { useProjectSettings } from './ProjectSettingsContext.js';

/** The enclosing viewport node's own `snap_2d_transforms_to_pixel`, or null in the editor's scene root. */
const PixelSnapContext = createContext<boolean | null>(null);
PixelSnapContext.displayName = 'PixelSnapContext';

export function PixelSnapProvider({ snaps, children }: { snaps: boolean; children: ReactNode }) {
  return <PixelSnapContext.Provider value={snaps}>{children}</PixelSnapContext.Provider>;
}

/** `Viewport::is_snap_2d_transforms_to_pixel_enabled` of the viewport a node renders in. */
export function useSnaps2DTransformsToPixel(): boolean {
  const own = useContext(PixelSnapContext);
  const { settings } = useProjectSettings();
  return own ?? projectSnaps2DTransformsToPixel(settings);
}
