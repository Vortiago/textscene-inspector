const isNetworkSharePath = (path: string): boolean => path.startsWith('//') || path.startsWith('\\\\');

/** ustring.cpp:4287 */
function isAbsolutePath(path: string): boolean {
  if (path.length > 1)
    return path[0] === '/' || path[0] === '\\' || path.includes(':/') || path.includes(':\\');
  return path === '/' || path === '\\';
}

export const isRelativePath = (path: string): boolean => !isAbsolutePath(path);

function splitDrive(path: string): [string, string] {
  const scheme = path.indexOf('://');
  if (scheme > 0 && /^[A-Za-z0-9]+$/.test(path.slice(0, scheme))) {
    return [path.slice(0, scheme + 3), path.slice(scheme + 3)];
  }
  if (isNetworkSharePath(path)) return [path.slice(0, 2), path.slice(2)];
  if (path.startsWith('/') || path.startsWith('\\')) return [path.slice(0, 1), path.slice(1)];
  let drive = path.indexOf(':/');
  if (drive === -1) drive = path.indexOf(':\\');
  // `find_char` answers -1 for a path with no slash, so a drive needs a slash after it.
  if (drive !== -1 && drive < path.indexOf('/')) return [path.slice(0, drive + 2), path.slice(drive + 2)];
  return ['', path];
}

/** ustring.cpp:4152 */
export function simplifyPath(path: string): string {
  const [drive, rest] = splitDrive(path);
  let body = rest.replaceAll('\\', '/');
  while (body.includes('//')) body = body.replaceAll('//', '/');
  const dirs = body.split('/').filter((dir) => dir !== '');
  // Godot keeps a `..` that climbs out of `res://`.
  const isAbsolute = isAbsolutePath(path) && !path.startsWith('res://');
  for (let index = 0; index < dirs.length; index += 1) {
    if (dirs[index] === '.') {
      dirs.splice(index, 1);
      index -= 1;
    } else if (dirs[index] === '..') {
      if (index !== 0 && dirs[index - 1] !== '..') {
        dirs.splice(index - 1, 2);
        index -= 2;
      } else if (isAbsolute && index === 0) {
        dirs.splice(index, 1);
        index -= 1;
      }
    }
  }
  return drive + dirs.join('/');
}

/** ustring.cpp:4967 */
export function baseDir(path: string): string {
  let end = 0;
  const scheme = path.indexOf('://');
  if (scheme !== -1) end = scheme + 3;
  if (end === 0) {
    let drive = path.indexOf(':/');
    if (drive === -1) drive = path.indexOf(':\\');
    if (drive !== -1) end = drive + 2;
  }
  if (end === 0 && isNetworkSharePath(path)) {
    let server = path.indexOf('/', 2);
    if (server === -1) server = path.indexOf('\\', 2);
    let share = path.indexOf('/', server + 1);
    if (share === -1) share = path.indexOf('\\', server + 1);
    if (share !== -1) end = share + 1;
  }
  if (end === 0 && path.startsWith('/')) end = 1;
  const base = path.slice(0, end);
  const rest = path.slice(end);
  const separator = Math.max(rest.lastIndexOf('/'), rest.lastIndexOf('\\'));
  return separator === -1 ? base : base + rest.slice(0, separator);
}

/** ustring.cpp:5046 */
export function pathJoin(base: string, file: string): string {
  if (base === '') return file;
  if (base.endsWith('/') || file.startsWith('/')) return base + file;
  return `${base}/${file}`;
}
