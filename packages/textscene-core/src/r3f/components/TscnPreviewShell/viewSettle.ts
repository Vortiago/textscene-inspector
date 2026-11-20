import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Scene } from '../../../scene/openScene.js';
import type { ViewAnswers } from '../../viewStatus/viewAnswers.js';
import type { ViewStatus } from '../../viewStatus/viewStatus.js';

/** Whether the view has settled on the scene's current revision, or why it never will. */
export type ViewSettle =
  | { readonly status: 'pending' }
  | { readonly status: 'settled' }
  | { readonly status: 'failed'; readonly reason: string };

const PENDING: ViewSettle = { status: 'pending' };

/** What one wait on `settled` answered, for the view, revision and pending round it waited on. */
interface Answer {
  readonly view: ViewAnswers;
  readonly revision: number;
  readonly round: number;
  readonly settle: ViewSettle;
}

// The view's own `status`: the entry gives no event when a settled view starts to load a file again.
/** Each new view, revision or pending round waits on `settled` again, so an older answer reads as pending. */
export function useViewSettle(scene: Scene, view: ViewAnswers | null, status: ViewStatus): ViewSettle {
  const revision = useSyncExternalStore(scene.subscribe, scene.revision);
  const { isPending, round } = usePendingRound(status);
  const [answer, setAnswer] = useState<Answer | null>(null);
  useEffect(() => {
    if (!view || isPending) return undefined;
    let isCurrent = true;
    const answered = (settle: ViewSettle) => {
      if (isCurrent) setAnswer({ view, revision, round, settle });
    };
    view.settled.then(
      () => answered({ status: 'settled' }),
      (error: unknown) => answered({ status: 'failed', reason: reasonOf(error) })
    );
    return () => {
      isCurrent = false;
    };
  }, [view, revision, round, isPending]);
  const isAnswerCurrent = answer?.view === view && answer.revision === revision && answer.round === round;
  return !isPending && isAnswerCurrent ? answer.settle : PENDING;
}

/** Whether the view is pending now, and how many times it has turned pending. */
function usePendingRound(status: ViewStatus): { isPending: boolean; round: number } {
  const isPending = useSyncExternalStore(status.subscribe, status.isPending);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (isPending) setRound((last) => last + 1);
  }, [isPending]);
  return { isPending, round };
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** `captureImage` rejects before `settled`, and a change may come between a report and a request. */
export async function captureWhenSettled(view: ViewAnswers): Promise<Blob> {
  await view.settled;
  return view.captureImage();
}
