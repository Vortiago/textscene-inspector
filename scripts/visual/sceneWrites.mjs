/* global window */

/** How long a write waits for its node, which a sub-scene holds once it loads. */
const NODE_WAIT_MS = 10000;

/** Applies each `{ path, property, text }` write and `{ path, method, args }` call in order. */
export async function applySceneWrites(page, hostCalls = []) {
  if (hostCalls.length === 0) return;
  await page.waitForFunction(() => window.textscene !== undefined);
  await page.evaluate(
    async ({ calls, waitMs }) => {
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
      for (const call of calls) {
        const node = await nodeAt(call.path);
        if ('property' in call) await node.set(call.property, await valueOf(call.text));
        else await node.call(call.method, ...(await Promise.all(call.args.map(valueOf))));
      }
    },
    { calls: hostCalls, waitMs: NODE_WAIT_MS }
  );
}

/** Selects the node at absolute `path` through the scene console, as a host's `selected` does. */
export async function selectThroughConsole(page, path) {
  await page.waitForFunction(() => window.textscene !== undefined);
  await page.waitForFunction((nodePath) => window.textscene.scene.getNodeOrNull(nodePath) !== null, path, {
    timeout: NODE_WAIT_MS,
  });
  await page.evaluate((nodePath) => window.textscene.select(window.textscene.scene.getNode(nodePath)), path);
}
