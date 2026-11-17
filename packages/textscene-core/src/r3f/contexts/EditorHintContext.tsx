/**
 * Godot's `Engine::is_editor_hint()`: true in the editor's views, false where the game runs. It is
 * the one intent every editor-only drawer reads, through the toggles of `ViewportModeContext` or
 * directly. The In-game mode of the view clears it.
 */
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

/**
 * Whether a node whose `editor_only` is `editorOnly` draws: always without the flag, and only in the
 * editor with it (`scene/3d/light_3d.cpp:287-288`, `scene/2d/light_2d.cpp:46-47`).
 */
export function useDrawsEditorOnly(editorOnly: boolean): boolean {
  const isEditorHint = useIsEditorHint();
  return !editorOnly || isEditorHint;
}
