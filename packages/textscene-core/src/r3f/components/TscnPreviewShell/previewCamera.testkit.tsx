import type { ReactNode } from 'react';
import { PreviewCameraProvider } from './previewCamera';

/** A scene whose tree never changes, so a preview a test starts holds. */
const STILL_SCENE = { getNodeOrNull: () => null, observe: () => () => {} };

/** The shell's camera preview, for a panel that a test mounts alone. */
export function TestPreviewCamera({
  initialCamera,
  children,
}: {
  initialCamera?: string | null;
  children: ReactNode;
}) {
  return (
    <PreviewCameraProvider scene={STILL_SCENE} initialCamera={initialCamera}>
      {children}
    </PreviewCameraProvider>
  );
}
