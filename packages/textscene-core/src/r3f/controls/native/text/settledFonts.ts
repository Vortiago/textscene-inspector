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

/** Turns the bytes of a font file into a face. Null is a load that failed: the face draws the bundled default. */
export type FaceLoader = (
  bytes: ArrayBuffer,
  nodePath: string
) => Promise<RegisteredCanvasFontMetrics | null>;

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

/** The fonts a forest read while they loaded, each with its {@link SettledFonts.fontVersion} then. */
export type AwaitedFonts = ReadonlyMap<object, number>;

export interface SettledFonts {
  /** The face of a font file's bytes: undefined while it loads, null for a load that failed. */
  peekFace(bytes: ArrayBuffer, nodePath: string): RegisteredCanvasFontMetrics | null | undefined;
  /** The outlines of a load of a font's bytes, keyed by `loadKey`: undefined while `read` runs. */
  peekOutlines(loadKey: object, read: () => Promise<SfntOutlines | null>): SfntOutlines | null | undefined;
  /**
   * The settled answer of each font, kept once its whole chain has settled: a settled load never
   * changes, so the chain composes once and keeps its identity for a reader that compares it.
   */
  readonly settled: WeakMap<FontResource, SettledFont & { status: 'settled' }>;
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
  /** Subscribes to the settle that settles `font`. Returns the unsubscribe. */
  subscribeFont(font: object, onSettle: () => void): () => void;
  /** Moves on each settle that wakes the readers of `font`. */
  fontVersion(font: object): number;
  /**
   * This preview's settled fonts, recording into `awaited` each font marked as awaited through
   * them, with its version then. A forest that hands this to every node learns each font its solve
   * and its painters read while it loaded, and watches those through {@link fontVersion}.
   */
  recording(awaited: Map<object, number>): SettledFonts;
  /** Subscribes to every settle of this preview's loads. Returns the unsubscribe. */
  subscribe(onSettle: () => void): () => void;
  /** Moves on every settle of this preview's loads. */
  version(): number;
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
  /** Written only by `pendingLoadsOf`, for the length of its read. */
  let pendingRead: Set<object> | null = null;

  function wakeFont(font: object): void {
    const store = fontSettles(font);
    store.set(store.get() + 1);
  }

  function wake(load: object): void {
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
    settles.set(settles.get() + 1);
    if (failures.length > 0) throw failures[0];
  }

  const notePending = (load: object) => void pendingRead?.add(load);
  const peekFaceOf = createSettledPeek<ArrayBuffer, RegisteredCanvasFontMetrics | null>(notePending, wake);
  const peekOutlinesOf = createSettledPeek<object, SfntOutlines | null>(notePending, wake);
  const fontVersion = (font: object) => fontSettles(font).get();

  const fonts: SettledFonts = {
    peekFace: (bytes, nodePath) => peekFaceOf(bytes, () => loadFace(bytes, nodePath)),
    peekOutlines: peekOutlinesOf,
    settled: new WeakMap(),
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
    awaitFont: (font, pending) => void awaited.set(font, new Set(pending)),
    subscribeFont: (font, onSettle) => fontSettles(font).subscribe(onSettle),
    fontVersion,
    recording: (record) => ({
      ...fonts,
      awaitFont(font, pending) {
        fonts.awaitFont(font, pending);
        if (!record.has(font)) record.set(font, fontVersion(font));
      },
    }),
    subscribe: settles.subscribe,
    version: settles.get,
  };
  return fonts;
}
