/**
 * The manifest of the plain app that consumes the packed tarballs, as a user of the package writes
 * one: the tarballs, the peer packages they name and the build tools.
 */

/**
 * @param {{ tarballs: Record<string, string>, peers: Record<string, string>, tools: Record<string, string> }} versions
 *   Each map takes a package name to a tarball path, a version or a version range.
 */
export function consumerManifest({ tarballs, peers, tools }) {
  const tarballSpecifiers = Object.entries(tarballs).map(([name, path]) => [name, `file:${path}`]);
  return {
    name: 'renderer-consumer',
    private: true,
    type: 'module',
    dependencies: { ...Object.fromEntries(tarballSpecifiers), ...peers },
    devDependencies: tools,
  };
}
