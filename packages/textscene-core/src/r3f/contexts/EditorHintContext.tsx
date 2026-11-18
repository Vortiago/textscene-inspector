import { createContext, useContext, type ReactNode } from 'react';

const EditorHintContext = createContext(true);
EditorHintContext.displayName = 'EditorHintContext';

/** The subtree draws as the running game does: no editor element, whatever the toolbar holds. */
export function RunningGameScope({ children }: { children: ReactNode }) {
  return <EditorHintContext.Provider value={false}>{children}</EditorHintContext.Provider>;
}

export function useIsEditorHint(): boolean {
  return useContext(EditorHintContext);
}

/** An `editor_only` node draws only in the editor (`light_3d.cpp:287-288`, `light_2d.cpp:46-47`). */
export function useDrawsEditorOnly(editorOnly: boolean): boolean {
  const isEditorHint = useIsEditorHint();
  return !editorOnly || isEditorHint;
}
