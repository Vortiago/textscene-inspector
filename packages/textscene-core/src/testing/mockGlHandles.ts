/**
 * Gives test-renderer's mock WebGL context a handle from each `create*` call, as a device does. The
 * mock returns undefined, and three keys its framebuffer state on the handle in a WeakMap
 * (`WebGLState.js:359`), so a render into a target would throw. With handles, every 3D canvas in a
 * unit test draws through the tonemap pass that a device draws through (ADR-0061).
 */

type GetContext = HTMLCanvasElement['getContext'];

/** The `create*` methods whose result three keys state on. */
const HANDLE_FACTORIES = [
  'createBuffer',
  'createFramebuffer',
  'createProgram',
  'createQuery',
  'createRenderbuffer',
  'createSampler',
  'createShader',
  'createTexture',
  'createTransformFeedback',
  'createVertexArray',
] as const;

/** Set on the prototype once the trap is in, since the files of one worker share happy-dom's. */
const INSTALLED = Symbol.for('textscene.mockGlHandles');

/**
 * Wraps each `getContext` that test-renderer installs on the canvas prototype, whose WebGL contexts
 * then answer handles. A `getContext` set on one canvas stays that canvas's own, as it would without
 * the accessor. A file in the node environment has no canvas to wrap.
 */
export function giveMockContextsHandles(): void {
  if (typeof HTMLCanvasElement === 'undefined') return;
  const prototype = HTMLCanvasElement.prototype as HTMLCanvasElement & { [INSTALLED]?: true };
  if (prototype[INSTALLED]) return;
  prototype[INSTALLED] = true;
  let wrapped = withHandles(prototype.getContext);
  Object.defineProperty(prototype, 'getContext', {
    configurable: true,
    get: () => wrapped,
    set(this: HTMLCanvasElement, next: GetContext) {
      if (this === prototype) wrapped = withHandles(next);
      else Object.defineProperty(this, 'getContext', { value: next, writable: true, configurable: true });
    },
  });
}

function withHandles(getContext: GetContext): GetContext {
  return function (this: HTMLCanvasElement, ...args: Parameters<GetContext>) {
    const context: unknown = getContext.apply(this, args);
    if (args[0].startsWith('webgl') && context) answerHandles(context as Record<string, unknown>);
    return context;
  } as GetContext;
}

/** Replaces each factory that answers nothing with one that answers a fresh object. */
function answerHandles(context: Record<string, unknown>): void {
  for (const name of HANDLE_FACTORIES) {
    const factory = context[name];
    if (typeof factory === 'function' && factory.call(context) === undefined) context[name] = () => ({});
  }
}
