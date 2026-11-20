import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Scene } from '../../../scene/openScene.js';
import type { ViewAnswers } from '../../viewStatus/viewAnswers.js';

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

/** Each new view, revision or pending round waits on `settled` again, so an older answer reads as pending. */
export function useViewSettle(
  scene: Scene,
  view: ViewAnswers | null,
  { isPending, round }: { isPending: boolean; round: number }
): ViewSettle {
  const revision = useSyncExternalStore(scene.subscribe, scene.revision);
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

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** `captureImage` rejects before `settled`, and a change may come between a report and a request. */
export async function captureWhenSettled(view: Pick<ViewAnswers, 'settled' | 'captureImage'>): Promise<Blob> {
  await view.settled;
  return view.captureImage();
}
