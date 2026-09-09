/**
 * What the gate reads out of the page: the sub-viewport surface's own pixel
 * canvas, and the objective stats of every rendered Control.
 *
 * Both run in the browser, so everything here is a `page.evaluate` payload —
 * self-contained, with no closure over anything in this module.
 */

/* global document, getComputedStyle */ // the page.evaluate callbacks below run in the browser

/** The pixel canvas a named sub-viewport surface published, sampled at each probe. */
export async function readSurface(page, wanted) {
  return page.evaluate((wanted) => {
    const el = document.querySelector(
      `[data-viewport-surface][data-node-name="${wanted.node}"]`
    );
    if (!el) return { reason: `no viewport surface named "${wanted.node}"` };
    const canvas = el.querySelector('[data-viewport-pixels]');
    if (!canvas) return { reason: 'the surface published no pixel canvas' };
    const context = canvas.getContext('2d');
    if (!context) return { reason: 'the pixel canvas has no 2D context' };
    return {
      reason: null,
      size: [canvas.width, canvas.height],
      samples: wanted.probes.map(([x, y]) => [
        ...context.getImageData(x, y, 1, 1).data,
      ].slice(0, 3)),
    };
  }, wanted);
}

/** Every objective fact the assertions read, in one page round trip. */
export async function readOverlayStats(page) {
  return page.evaluate(() => {
    const all = [...document.querySelectorAll('[data-control-type]')];
    return {
      controls: all.length,
      fallbacks: document.querySelectorAll('[data-control-fallback="true"]').length,
      types: [...new Set(all.map((e) => e.getAttribute('data-control-type')))].sort(),
      // Every rendered string, for assertions. `textSample` below is the
      // truncated human-readable version for the report — never assert on it,
      // a required string can fall outside the slice.
      texts: all.map((e) => e.textContent?.trim() ?? '').filter((t) => t.length > 0),
      // Node names the browser actually LAYS OUT. Text can't answer "is this
      // hidden": a visible container's textContent still includes a
      // `display: none` child's string. Per-node box presence can — which is
      // the OptionButton/Button/GridContainer bug this gate now guards.
      laidOutNodes: all
        .filter((e) => e.getClientRects().length > 0)
        .map((e) => e.getAttribute('data-node-name'))
        .filter((n) => n),
      // CheckBox draws its state as an indicator glyph; without one a checked
      // and an unchecked box are indistinguishable on screen.
      checkIndicators: [...document.querySelectorAll('[data-check-indicator]')].map((e) => ({
        state: e.getAttribute('data-check-indicator'),
        style: e.getAttribute('data-check-style'),
      })),
      // Computed CSS for named nodes: the only way to see modulate (opacity /
      // filter), the Control transform, cross-axis size flags, and a
      // TextureRect's expand_mode minimum — none of which change textContent.
      computed: Object.fromEntries(
        all
          .filter((e) => e.getAttribute('data-node-name'))
          .map((e) => {
            const cs = getComputedStyle(e);
            const box = e.getBoundingClientRect();
            return [
              e.getAttribute('data-node-name'),
              {
                opacity: cs.opacity,
                filter: cs.filter,
                transform: cs.transform,
                alignSelf: cs.alignSelf,
                width: Math.round(box.width),
                height: Math.round(box.height),
              },
            ];
          })
      ),
      // A slider's grabber is placed by a calc() over the widget's OWN size,
      // which only a real layout engine resolves — happy-dom returns nothing
      // for it. Record each grabber's centre relative to its slider's box,
      // which is the frame Godot's placement math is written in, so an
      // inverted axis (a VSlider counting down from the top) is catchable.
      //
      // offsetLeft/offsetWidth, NOT getBoundingClientRect: the 2D stage paints
      // the overlay under a zoom transform, which scales every client rect and
      // would make these numbers depend on the fit-to-viewport factor rather
      // than on the CSS the component emitted. The offset* family reports
      // layout pixels, and an absolutely-positioned part's offsetParent is the
      // Control root itself.
      sliderGrabbers: Object.fromEntries(
        all
          .map((e) => [e, e.querySelector(':scope > [data-slider-part="grabber"]')])
          .filter(([e, g]) => g && e.getAttribute('data-node-name'))
          .map(([e, g]) => [
            e.getAttribute('data-node-name'),
            {
              x: g.offsetLeft + g.offsetWidth / 2,
              y: g.offsetTop + g.offsetHeight / 2,
              trackWidth: e.offsetWidth,
              trackHeight: e.offsetHeight,
            },
          ])
      ),
      icons: [...document.querySelectorAll('[data-button-icon]')].map((e) =>
        e.getAttribute('data-button-icon')
      ),
      textSample: all
        .filter((e) => e.textContent && e.textContent.trim().length)
        .slice(0, 6)
        .map((e) => e.textContent.trim().slice(0, 40)),
    };
  });
}
