/**
 * The pixel harness injected into every page: the built rasteriser module, the
 * counters the assertions read, and the NAIVE rasterisation that is suite A's
 * control condition.
 */

/* global document, getComputedStyle, Image, XMLSerializer */ // this file's payloads run in the browser

/**
 * Injected into every page: loads the built module off a blob URL (it has zero
 * imports, so it needs no import map) and installs the pixel helpers the
 * assertions below read.
 */
export async function installHarness(page, source) {
  await page.evaluate(async (code) => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    globalThis.__raster = await import(url);

    /** Every pixel of a canvas, plus counters. Throws if the canvas is tainted. */
    globalThis.__pixels = (canvas) => {
      const ctx = canvas.getContext('2d');
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const near = (i, [r, g, b], tol) =>
        Math.abs(data[i] - r) <= tol &&
        Math.abs(data[i + 1] - g) <= tol &&
        Math.abs(data[i + 2] - b) <= tol;
      return {
        width: canvas.width,
        height: canvas.height,
        total: data.length / 4,
        opaque: () => {
          let n = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i] > 8) n++;
          return n;
        },
        matching: (rgb, tol = 3) => {
          let n = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 200 && near(i, rgb, tol)) n++;
          }
          return n;
        },
        brighterThan: (threshold) => {
          let n = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (
              data[i + 3] > 200 &&
              data[i] >= threshold &&
              data[i + 1] >= threshold &&
              data[i + 2] >= threshold
            )
              n++;
          }
          return n;
        },
        distinctColours: () => {
          const seen = new Set();
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 200) seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
          }
          return seen.size;
        },
      };
    };

    /**
     * The NAIVE rasterisation — clone, inline computed styles, foreignObject —
     * with no image-source inlining. It is the control condition for suite A:
     * whatever it drops is what `rasterizeControlSubtree` has to rescue.
     */
    globalThis.__rasteriseNaive = async (element) => {
      const w = element.offsetWidth;
      const h = element.offsetHeight;
      const clone = element.cloneNode(true);
      const from = [element, ...element.querySelectorAll('*')];
      const to = [clone, ...clone.querySelectorAll('*')];
      for (let i = 0; i < from.length; i++) {
        const cs = getComputedStyle(from[i]);
        let text = '';
        for (let p = 0; p < cs.length; p++) text += `${cs.item(p)}:${cs.getPropertyValue(cs.item(p))};`;
        to[i].setAttribute('style', text);
      }
      clone.style.position = 'relative';
      clone.style.left = '0';
      clone.style.top = '0';
      clone.style.margin = '0';
      const holder = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      holder.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      holder.appendChild(clone);
      const markup = new XMLSerializer().serializeToString(holder);
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
        `<foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`;
      const image = new Image();
      const ok = await new Promise((res) => {
        image.onload = () => res(true);
        image.onerror = () => res(false);
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      });
      if (!ok) return null;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(image, 0, 0, w, h);
      return canvas;
    };
  }, source);
}
