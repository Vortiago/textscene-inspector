import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useIsEditorHint } from '../contexts/EditorHintContext.js';
import { useByValue } from '../hooks/useByValue.js';
import { sameData } from '../../utils/sameData.js';
import { DEFAULT_SHOW, RUNNING_GAME_SHOW, withShown, type ViewShow } from './viewShow.js';

const ViewShowContext = createContext<ViewShow>(DEFAULT_SHOW);
ViewShowContext.displayName = 'ViewShowContext';

/** The gizmos on their own, so a gizmo re-renders for that key alone. */
const ShowGizmosContext = createContext(DEFAULT_SHOW.gizmos);
ShowGizmosContext.displayName = 'ShowGizmosContext';

/** A key `show` leaves out has its default. */
export function ViewShowProvider({ show, children }: { show?: Partial<ViewShow>; children: ReactNode }) {
  // By value, so a host that passes a new object of the same keys re-renders no reader.
  const value = useByValue(withShown(DEFAULT_SHOW, show), sameData);
  return (
    <ViewShowContext.Provider value={value}>
      <ShowGizmosContext.Provider value={value.gizmos}>{children}</ShowGizmosContext.Provider>
    </ViewShowContext.Provider>
  );
}

/** Safe without a provider. Where the game runs, the helpers read as the game draws them. */
export function useViewShow(): ViewShow {
  const show = useContext(ViewShowContext);
  const isEditorHint = useIsEditorHint();
  return useMemo(() => (isEditorHint ? show : { ...show, ...RUNNING_GAME_SHOW }), [isEditorHint, show]);
}

export function useShowGizmos(): boolean {
  const showGizmos = useContext(ShowGizmosContext);
  const isEditorHint = useIsEditorHint();
  return showGizmos && isEditorHint;
}
