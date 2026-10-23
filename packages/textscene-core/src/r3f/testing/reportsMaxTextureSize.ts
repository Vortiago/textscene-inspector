/** A `beforeReturn` for `ReactThreeTestRenderer.create`, whose mock context reports no `MAX_TEXTURE_SIZE`. */

/** Makes the test canvas's context report `size` as the GPU's largest texture side. */
export function reportsMaxTextureSize(size: number) {
  return (canvas: HTMLCanvasElement): void => {
    const getContext = canvas.getContext.bind(canvas) as (id: string) => WebGL2RenderingContext;
    canvas.getContext = ((id: string) => {
      const context = getContext(id);
      const getParameter = context.getParameter.bind(context);
      context.getParameter = (parameter: number) =>
        parameter === context.MAX_TEXTURE_SIZE ? size : getParameter(parameter);
      return context;
    }) as typeof canvas.getContext;
  };
}
