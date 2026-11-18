/* global window */

/** How long a write waits for its node, which a sub-scene holds once it loads. */
const NODE_WAIT_MS = 10000;

/** Applies `sets`, each `{ path, property, text }`, in order. Throws where a path names no node. */
export async function applySceneWrites(page, sets = []) {
  if (sets.length === 0) return;
  await page.waitForFunction(() => window.textscene !== undefined);
  await page.evaluate(
    async ({ writes, waitMs }) => {
      const { scene, variant } = window.textscene;
      const nodeAt = async (path) => {
        const giveUpAt = Date.now() + waitMs;
        let node = scene.getNodeOrNull(path);
        while (!node && Date.now() < giveUpAt) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          node = scene.getNodeOrNull(path);
        }
        if (!node) throw new Error(`expected a node at ${path}, found none`);
        return node;
      };
      // `str_to_var` loads the file a `Resource("…")` names, which the scene does through `load`.
      const valueOf = async (text) => {
        const file = /^Resource\("([^"]+)"\)$/.exec(text)?.[1];
        return file ? scene.load(file) : variant(text);
      };
      for (const { path, property, text } of writes) {
        await (await nodeAt(path)).set(property, await valueOf(text));
      }
    },
    { writes: sets, waitMs: NODE_WAIT_MS }
  );
}
