/**
 * The host half of a preview capture. It mirrors the capture state the webview reports and
 * holds each request until that state answers it: `ready` posts the request, `unavailable`
 * answers its reason, and `pending` keeps it waiting. Nothing polls the canvas.
 */

/** A capture's answer: the viewport as a `data:image/png;base64,…` URL, or why there is none. */
export type PreviewCapture = { readonly dataUrl: string } | { readonly error: string };

/** The webview's capture state, plus `loading` until its first `webviewReady`. */
export type CaptureState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'ready' }
  | { readonly kind: 'unavailable'; readonly reason: string };

/** What the queue posts to the webview. */
export interface CaptureChannel {
  /** Sends one `capturePreview` with the id its answer carries. */
  postRequest(requestId: string): void;
  /** Sends one `capturePing`, which a live webview answers with a `capturePong` at once. */
  postPing(pingId: string): void;
}

/**
 * A webview that crashed or hung posts nothing more, and a capture must still end. While a
 * request waits, the queue pings the webview this often. A live webview answers between two
 * tasks, since its texture builds run in a worker or in bands, so an unanswered ping ends
 * every request. A scene that takes long to render never does.
 */
export const PING_INTERVAL_MS = 10000;

/**
 * Before `webviewReady` the webview has no listener, so a ping has no answer. Its load does
 * not depend on the scene, so a fixed deadline ends a request only for a webview that broke.
 */
export const WEBVIEW_LOAD_DEADLINE_MS = 30000;

const CLOSED: PreviewCapture = { error: 'The preview was closed.' };
const CANCELLED: PreviewCapture = { error: 'The capture was cancelled.' };
const NOT_LOADED: PreviewCapture = {
  error: `The preview webview did not load within ${WEBVIEW_LOAD_DEADLINE_MS / 1000} s.`,
};
const NOT_ANSWERING: PreviewCapture = {
  error: `The preview stopped answering for ${PING_INTERVAL_MS / 1000} s.`,
};
const LOADING: CaptureState = { kind: 'loading' };
const PENDING: CaptureState = { kind: 'pending' };

interface CaptureRequest {
  readonly resolve: (capture: PreviewCapture) => void;
  /** Ends the request after the load deadline. Set only while the webview loads. */
  loadTimer?: ReturnType<typeof setTimeout>;
  /** Set while the webview holds the request. */
  requestId?: string;
  /** Stops listening to the caller's signal. */
  release?: () => void;
}

export class PreviewCaptureQueue {
  private _state: CaptureState = LOADING;
  private _isClosed = false;
  private _waiting: CaptureRequest[] = [];
  private readonly _inFlight = new Map<string, CaptureRequest>();
  private _requestSeq = 0;
  /** Runs while a request waits on a loaded webview. Written only by `_watchLiveness`. */
  private _pingTimer: ReturnType<typeof setInterval> | undefined;
  /** The ping the webview has not answered yet. Cleared by its `capturePong`. */
  private _unansweredPingId: string | undefined;
  private _pingSeq = 0;

  public constructor(private readonly _channel: CaptureChannel) {}

  /** The capture's answer. An abort of `signal` ends the request with a cancelled answer. */
  public request(signal?: AbortSignal): Promise<PreviewCapture> {
    if (this._isClosed) return Promise.resolve(CLOSED);
    if (signal?.aborted) return Promise.resolve(CANCELLED);
    return new Promise((resolve) => {
      const request: CaptureRequest = { resolve };
      if (signal) {
        const cancel = () => this._end(request, CANCELLED);
        signal.addEventListener('abort', cancel, { once: true });
        request.release = () => signal.removeEventListener('abort', cancel);
      }
      if (this._state.kind === 'loading') {
        request.loadTimer = setTimeout(() => this._end(request, NOT_LOADED), WEBVIEW_LOAD_DEADLINE_MS);
      }
      this._waiting.push(request);
      this._serve();
    });
  }

  /**
   * A new webview document has installed its listener. It reports its own capture state
   * next, and it never received a request the old document held, so those wait again.
   */
  public webviewLoaded(): void {
    this._state = PENDING;
    for (const request of this._inFlight.values()) {
      request.requestId = undefined;
      this._waiting.push(request);
    }
    this._inFlight.clear();
    for (const request of this._waiting) {
      clearTimeout(request.loadTimer);
      request.loadTimer = undefined;
    }
    this._unansweredPingId = undefined;
    this._watchLiveness();
  }

  public setState(state: Exclude<CaptureState, { kind: 'loading' }>): void {
    this._state = state;
    this._serve();
  }

  /** Settles the request `requestId` names. An unknown id has ended already. */
  public answer(requestId: string, capture: PreviewCapture): void {
    const request = this._inFlight.get(requestId);
    if (request) this._end(request, capture);
  }

  /** The webview answered the ping `pingId`. */
  public pong(pingId: string): void {
    if (pingId === this._unansweredPingId) this._unansweredPingId = undefined;
  }

  /** Answers every request with the closed preview, and each later request too. */
  public close(): void {
    this._isClosed = true;
    for (const request of this._pendingRequests()) this._end(request, CLOSED);
  }

  private _serve(): void {
    const state = this._state;
    if (state.kind === 'ready') {
      for (const request of this._waiting.splice(0)) this._send(request);
    } else if (state.kind === 'unavailable') {
      for (const request of [...this._waiting]) this._end(request, { error: state.reason });
    }
    this._watchLiveness();
  }

  private _send(request: CaptureRequest): void {
    const requestId = `capture-${++this._requestSeq}`;
    request.requestId = requestId;
    this._inFlight.set(requestId, request);
    this._channel.postRequest(requestId);
  }

  /** Removes `request` from the queue and settles it with `capture`. */
  private _end(request: CaptureRequest, capture: PreviewCapture): void {
    clearTimeout(request.loadTimer);
    request.release?.();
    if (request.requestId !== undefined) this._inFlight.delete(request.requestId);
    this._waiting = this._waiting.filter((waiting) => waiting !== request);
    request.resolve(capture);
    this._watchLiveness();
  }

  private _pendingRequests(): CaptureRequest[] {
    return [...this._waiting, ...this._inFlight.values()];
  }

  /** Pings while a request waits on a loaded webview, and stops when none does. */
  private _watchLiveness(): void {
    const shouldWatch = this._state.kind !== 'loading' && this._pendingRequests().length > 0;
    if (!shouldWatch) {
      clearInterval(this._pingTimer);
      this._pingTimer = undefined;
      this._unansweredPingId = undefined;
      return;
    }
    if (this._pingTimer !== undefined) return;
    this._pingTimer = setInterval(() => this._checkPing(), PING_INTERVAL_MS);
  }

  private _checkPing(): void {
    if (this._unansweredPingId === undefined) {
      this._ping();
      return;
    }
    for (const request of this._pendingRequests()) this._end(request, NOT_ANSWERING);
  }

  private _ping(): void {
    const pingId = `ping-${++this._pingSeq}`;
    this._unansweredPingId = pingId;
    this._channel.postPing(pingId);
  }
}
