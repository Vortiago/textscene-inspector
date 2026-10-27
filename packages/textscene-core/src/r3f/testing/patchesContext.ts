/** A `beforeReturn` for `ReactThreeTestRenderer.create` that changes the mock context the canvas hands out. */

/** Runs `patch` on the test canvas's context each time it is requested. */
export function patchesContext(patch: (context: WebGL2RenderingContext) => void) {
  return (canvas: HTMLCanvasElement): void => {
    const getContext = canvas.getContext.bind(canvas) as (id: string) => WebGL2RenderingContext;
    canvas.getContext = ((id: string) => {
      const context = getContext(id);
      patch(context);
      return context;
    }) as typeof canvas.getContext;
  };
}
