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

/**
 * A webview whose renderer process crashed or hung posts nothing more, and an agent's tool
 * call must still end. A live webview answers from its capture state well inside this, so
 * the deadline ends only a call that no state change would answer.
 */
export const CAPTURE_DEADLINE_MS = 30000;

const CLOSED: PreviewCapture = { error: 'The preview was closed.' };
const LOADING: CaptureState = { kind: 'loading' };
const PENDING: CaptureState = { kind: 'pending' };

interface CaptureRequest {
  readonly resolve: (capture: PreviewCapture) => void;
  timer?: ReturnType<typeof setTimeout>;
  /** Set while the webview holds the request, so a timeout names the phase it expired in. */
  requestId?: string;
}

export class PreviewCaptureQueue {
  private _state: CaptureState = LOADING;
  private _closed = false;
  private _waiting: CaptureRequest[] = [];
  private readonly _inFlight = new Map<string, CaptureRequest>();
  private _requestSeq = 0;

  /** `postRequest` sends one `capturePreview` with the id its answer carries. */
  public constructor(private readonly _postRequest: (requestId: string) => void) {}

  public request(): Promise<PreviewCapture> {
    if (this._closed) return Promise.resolve(CLOSED);
    return new Promise((resolve) => {
      const request: CaptureRequest = { resolve };
      request.timer = setTimeout(() => this._expire(request), CAPTURE_DEADLINE_MS);
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
  }

  public setState(state: Exclude<CaptureState, { kind: 'loading' }>): void {
    this._state = state;
    this._serve();
  }

  /** Settles the request `requestId` names. An unknown id has expired already. */
  public answer(requestId: string, capture: PreviewCapture): void {
    const request = this._inFlight.get(requestId);
    if (!request) return;
    this._inFlight.delete(requestId);
    settle(request, capture);
  }

  /** Answers every request with the closed preview, and each later request too. */
  public close(): void {
    this._closed = true;
    for (const request of [...this._waiting, ...this._inFlight.values()]) settle(request, CLOSED);
    this._waiting = [];
    this._inFlight.clear();
  }

  private _serve(): void {
    const state = this._state;
    if (state.kind === 'ready') {
      for (const request of this._waiting.splice(0)) this._send(request);
    } else if (state.kind === 'unavailable') {
      for (const request of this._waiting.splice(0)) settle(request, { error: state.reason });
    }
  }

  private _send(request: CaptureRequest): void {
    const requestId = `capture-${++this._requestSeq}`;
    request.requestId = requestId;
    this._inFlight.set(requestId, request);
    this._postRequest(requestId);
  }

  private _expire(request: CaptureRequest): void {
    if (request.requestId !== undefined) {
      this._inFlight.delete(request.requestId);
    } else {
      this._waiting = this._waiting.filter((waiting) => waiting !== request);
    }
    request.resolve({ error: expiryReason(request, this._state) });
  }
}

function settle(request: CaptureRequest, capture: PreviewCapture): void {
  clearTimeout(request.timer);
  request.resolve(capture);
}

function expiryReason(request: CaptureRequest, state: CaptureState): string {
  const seconds = CAPTURE_DEADLINE_MS / 1000;
  if (request.requestId !== undefined) return `The preview did not answer the capture within ${seconds} s.`;
  if (state.kind === 'loading') return `The preview webview did not load within ${seconds} s.`;
  return `The preview canvas did not create its renderer within ${seconds} s.`;
}
