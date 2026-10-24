/** The `subscribe` of a `useSyncExternalStore` that has nothing to watch: it never fires, and its unsubscribe does nothing. */
export const subscribeToNothing = (): (() => void) => () => {};
