/**
 * Ambient type declarations for CSS Module imports across the core package.
 * Vite (web app) and esbuild-css-modules-plugin (VS Code webview) handle
 * the runtime side; this file teaches TypeScript that the import returns
 * a hashed class-name lookup map.
 */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
