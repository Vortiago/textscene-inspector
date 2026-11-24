import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createEditorCameras, type EditorCameras } from './editorCameras.js';

const EditorCamerasContext = createContext<EditorCameras | null>(null);
EditorCamerasContext.displayName = 'EditorCamerasContext';

/** The caller ends the cameras it gives, as `mountScene` does on its dispose. */
export function EditorCamerasProvider({
  cameras,
  children,
}: {
  cameras: EditorCameras;
  children: ReactNode;
}) {
  return <EditorCamerasContext.Provider value={cameras}>{children}</EditorCamerasContext.Provider>;
}

/** A host's own cameras win. The view's own end with its unmount. */
export function EditorCamerasScope({ children }: { children: ReactNode }) {
  if (useEditorCameras()) return children;
  return <OwnEditorCameras>{children}</OwnEditorCameras>;
}

function OwnEditorCameras({ children }: { children: ReactNode }) {
  const [cameras, setCameras] = useState(createEditorCameras);
  useEffect(() => {
    // StrictMode's extra mount follows an unmount that ended the first cameras.
    if (cameras.hasEnded()) setCameras(createEditorCameras());
    return () => cameras.end(new Error('expected a mounted view, got an unmounted one'));
  }, [cameras]);
  return <EditorCamerasProvider cameras={cameras}>{children}</EditorCamerasProvider>;
}

/** Null with no provider, so a stage mounted alone in a test still renders. */
export function useEditorCameras(): EditorCameras | null {
  return useContext(EditorCamerasContext);
}
