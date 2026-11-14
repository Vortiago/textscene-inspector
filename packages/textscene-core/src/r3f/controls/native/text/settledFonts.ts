/**
 * The font loads of one preview and the readers they wake: the second stage of a font, after its
 * file arrives on the font bus (ADR-0059). Each `ResourceLoader` holds one, so a font that settles
 * in one preview wakes no reader of another.
 */
import type { FontResource } from '../../../../resources/fonts/font/types';
import { createExternalStore } from '../../../hooks/createExternalStore';
import { perObject } from '../../../../utils/perObject';
import type { FontMetrics } from './fontMetrics';
import type { RegisteredCanvasFontMetrics } from './runtimeFontMetrics';
import { loadSceneFontMetrics } from './sceneFontLoad';
import { createSettledPeek } from './settledChannel';
import type { SfntOutlines } from './sfntOutlines';

/** A face whose bytes FreeType cannot open: Godot draws no text in it (`text_server_adv.cpp:1466-1476`). */
export const UNOPENED_FACE = Symbol('unopened face');

/**
 * The face the bytes of a font file load as. Null is a load that failed only in the browser: the
 * face draws the bundled default.
 */
export type LoadedFace = RegisteredCanvasFontMetrics | null | typeof UNOPENED_FACE;

/** Turns the bytes of a font file into a face. */
export type FaceLoader = (bytes: ArrayBuffer, nodePath: string) => Promise<LoadedFace>;

/** A font of a **Fallback chain**, and the settled metrics of the face it draws. Null is the bundled font. */
export interface SettledChainFace {
  readonly font: FontResource | null;
  readonly metrics: FontMetrics;
  /** Whether `metrics` are the bundled font's, standing in for a first face that is missing. */
  readonly isStandIn?: true;
}

/** A font of the scene with every face of its chain, or the reason it is not there yet. */
export type SettledFont =
  | { readonly status: 'none' }
  | { readonly status: 'loading' }
  | { readonly status: 'settled'; readonly face: FontMetrics; readonly chain: readonly SettledChainFace[] };

/** A font whose whole chain has settled, composed into the face it draws. */
export type ComposedFont = SettledFont & { readonly status: 'settled' };

/** The fonts a forest read while they loaded, each with its {@link SettledFonts.fontVersion} then. */
export type AwaitedFonts = ReadonlyMap<object, number>;

export interface SettledFonts {
  /** The face of a font file's bytes, as {@link LoadedFace} answers, and undefined while it loads. */
  peekFace(bytes: ArrayBuffer, nodePath: string): LoadedFace | undefined;
  /** The outlines of a load of a font's bytes, keyed by `loadKey`: undefined while `read` runs. */
  peekOutlines(loadKey: object, read: () => Promise<SfntOutlines | null>): SfntOutlines | null | undefined;
  /**
   * The composed answer of `font`: the one kept, else what `compose` answers, kept when it is not null.
   * A settled load never changes, so the chain composes once and keeps its identity for a reader
   * that compares it.
   */
  keep(font: FontResource, compose: () => ComposedFont | null): ComposedFont | null;
  /**
   * Runs `read` and answers with the loads still in flight that it peeked: the loads a font whose
   * answer `read` gives waits on.
   */
  pendingLoadsOf<T>(read: () => T): { value: T; pending: ReadonlySet<object> };
  /**
   * Marks `font` as read while `pending` loads were in flight. The settle of the last of them wakes
   * the readers of `font`, which read it again, so a settle of another font wakes none.
   */
  awaitFont(font: object, pending: ReadonlySet<object>): void;
  /** Subscribes to each font marked as awaited, as it is marked. Returns the unsubscribe. */
  subscribeAwaits(onAwait: (font: object) => void): () => void;
  /** Subscribes to the settle that settles `font`. Returns the unsubscribe. */
  subscribeFont(font: object, onSettle: () => void): () => void;
  /** Moves on each settle that wakes the readers of `font`. */
  fontVersion(font: object): number;
  /**
   * This preview's settled fonts, recording into `awaited` each font marked as awaited through
   * them, and each load peeked while in flight, with its version then. A forest that hands this to every node learns each font its solve
   * and its painters read while it loaded, and watches those through {@link fontVersion}.
   */
  recording(awaited: Map<object, number>): SettledFonts;
  /** Subscribes to every settle of this preview's loads. Returns the unsubscribe. */
  subscribe(onSettle: () => void): () => void;
  /** Moves on every settle of this preview's loads. */
  version(): number;
}

/** A load on the page, shared by every preview that peeks its key: the first peek starts it. */
interface PageLoad<T> {
  promise?: Promise<T>;
}

/**
 * The load of each key on the page, so a font decodes and registers its `FontFace` once for each
 * page while the wake of each load stays per preview. Written by the first peek of a key in any
 * preview, and never cleared: a key nothing holds goes with its load.
 */
const pageOutlineLoads = perObject((_loadKey: object): PageLoad<SfntOutlines | null> => ({}));
/** The same for faces, for each face loader: a test that passes its own loader shares no face with another. */
const pageFaceLoads = perObject((_loadFace: FaceLoader) =>
  perObject((_bytes: ArrayBuffer): PageLoad<LoadedFace> => ({}))
);

/** The promise of `shared`, which `load` starts on the first call. */
function pageLoad<T>(shared: PageLoad<T>, load: () => Promise<T>): Promise<T> {
  return (shared.promise ??= load());
}

/** `answer`, after it marks the load `key` as awaited through `fonts` while the load is in flight. */
function awaitedIfPending<T>(fonts: SettledFonts, key: object, answer: T | undefined): T | undefined {
  if (answer === undefined) fonts.awaitFont(key, new Set([key]));
  return answer;
}

/**
 * The settled fonts of one preview, loading each face with `loadFace`. A test passes a loader that
 * answers a stand-in face, or one that stays pending.
 *
 * @canonical The font loads of one preview, and the readers they wake
 */
export function createSettledFonts(loadFace: FaceLoader = loadSceneFontMetrics): SettledFonts {
  const settles = createExternalStore(0);
  const fontSettles = perObject((_font: object) => createExternalStore(0));
  /**
   * The loads each awaited font waits on. Written by `awaitFont`, and by each settle, which takes
   * its load out of each font and wakes the readers of a font that waits on none.
   */
  const awaited = new Map<object, Set<object>>();
  /** The listeners `awaitFont` calls with each font it marks. */
  const awaitListeners = new Set<(font: object) => void>();
  /** Written only by `pendingLoadsOf`, for the length of its read. */
  let pendingRead: Set<object> | null = null;

  function wakeFont(font: object): void {
    const store = fontSettles(font);
    store.set(store.get() + 1);
  }

  function wake(load: object): void {
    // Moved first, so a reader of one font that a wake renders reads the new version as its snapshot.
    settles.set(settles.get() + 1);
    const failures: unknown[] = [];
    for (const [font, pending] of awaited) {
      if (!pending.delete(load) || pending.size > 0) continue;
      awaited.delete(font);
      // A throwing reader of one font must not keep the next font asleep: the first error is rethrown.
      try {
        wakeFont(font);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) throw failures[0];
  }

  const notePending = (load: object) => void pendingRead?.add(load);
  const peekFaceOf = createSettledPeek<ArrayBuffer, LoadedFace>(notePending, wake);
  const peekOutlinesOf = createSettledPeek<object, SfntOutlines | null>(notePending, wake);
  const fontVersion = (font: object) => fontSettles(font).get();
  /** Written only by `keep`, once for each font whose chain has settled. */
  const composed = new WeakMap<FontResource, ComposedFont>();

  const fonts: SettledFonts = {
    peekFace: (bytes, nodePath) =>
      peekFaceOf(bytes, () => pageLoad(pageFaceLoads(loadFace)(bytes), () => loadFace(bytes, nodePath))),
    peekOutlines: (loadKey, read) => peekOutlinesOf(loadKey, () => pageLoad(pageOutlineLoads(loadKey), read)),
    keep(font, compose) {
      const kept = composed.get(font);
      if (kept) return kept;
      const answer = compose();
      if (answer) composed.set(font, answer);
      return answer;
    },
    pendingLoadsOf(read) {
      const outer = pendingRead;
      const pending = new Set<object>();
      pendingRead = pending;
      try {
        return { value: read(), pending };
      } finally {
        pendingRead = outer;
        for (const load of pending) outer?.add(load);
      }
    },
    awaitFont(font, pending) {
      awaited.set(font, new Set(pending));
      for (const onAwait of awaitListeners) onAwait(font);
    },
    subscribeAwaits(onAwait) {
      awaitListeners.add(onAwait);
      return () => void awaitListeners.delete(onAwait);
    },
    subscribeFont: (font, onSettle) => fontSettles(font).subscribe(onSettle),
    fontVersion,
    recording(record) {
      const recorded: SettledFonts = {
        ...fonts,
        // A load peeked while in flight is awaited as its own key, so a reader that reads no font,
        // such as the bundled outlines, wakes on that load alone.
        peekFace: (bytes, nodePath) => awaitedIfPending(recorded, bytes, fonts.peekFace(bytes, nodePath)),
        peekOutlines: (loadKey, read) =>
          awaitedIfPending(recorded, loadKey, fonts.peekOutlines(loadKey, read)),
        awaitFont(font, pending) {
          // Recorded first, so a listener the mark calls finds the font among those its forest awaits.
          if (!record.has(font)) record.set(font, fontVersion(font));
          fonts.awaitFont(font, pending);
        },
      };
      return recorded;
    },
    subscribe: settles.subscribe,
    version: settles.get,
  };
  return fonts;
}
