/** The job worker's bundled script, embedded by `bundler/esbuildPlugin.mjs` or `bundler/vitePlugin.mjs`. */
declare module 'virtual:texture-worker-source' {
  const source: string;
  export default source;
}
