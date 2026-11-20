import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Scene } from '../../../scene/openScene.js';
import type { ViewAnswers } from '../../viewStatus/viewAnswers.js';

/** Whether the view has settled on the scene's current revision, or why it never will. */
export type ViewSettle =
  | { readonly status: 'pending' }
  | { readonly status: 'settled' }
  | { readonly status: 'failed'; readonly reason: string };

const PENDING: ViewSettle = { status: 'pending' };

/** What one wait on `settled` answered, for the view and the revision it waited on. */
interface Answer {
  readonly view: ViewAnswers;
  readonly revision: number;
  readonly settle: ViewSettle;
}

/** Each new view or revision waits on `settled` again, so an answer for an older one reads as pending. */
export function useViewSettle(scene: Scene, view: ViewAnswers | null): ViewSettle {
  const revision = useSyncExternalStore(scene.subscribe, scene.revision);
  const [answer, setAnswer] = useState<Answer | null>(null);
  useEffect(() => {
    if (!view) return undefined;
    let isCurrent = true;
    const answered = (settle: ViewSettle) => {
      if (isCurrent) setAnswer({ view, revision, settle });
    };
    view.settled.then(
      () => answered({ status: 'settled' }),
      (error: unknown) => answered({ status: 'failed', reason: reasonOf(error) })
    );
    return () => {
      isCurrent = false;
    };
  }, [view, revision]);
  return answer?.view === view && answer.revision === revision ? answer.settle : PENDING;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** `captureImage` rejects before `settled`, and a change may come between a report and a request. */
export async function captureWhenSettled(view: ViewAnswers): Promise<Blob> {
  await view.settled;
  return view.captureImage();
}
