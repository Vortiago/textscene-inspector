/** Godot's `CommentRemover` (shader_preprocessor.cpp:258): the text with its comments taken out and its line breaks kept. */

export interface StrippedCode {
  readonly code: string;
  readonly error?: { readonly message: string; readonly line: number };
}

/** shader_preprocessor.cpp:258 */
export function stripComments(code: string): StrippedCode {
  const stripped: string[] = [];
  let index = 0;
  let line = 0;
  let commentLineOpen = 0;
  let commentsOpen = 0;
  let stringsOpen = 0;

  const advance = (what: string): boolean => {
    while (index < code.length) {
      const char = code[index++]!;
      if (char === '\n') {
        line += 1;
        stripped.push('\n');
      }
      if (char === what) return true;
    }
    return false;
  };

  while (index < code.length) {
    const char = code[index++]!;
    if (char === '"') {
      stringsOpen += stringsOpen <= 0 ? 1 : -1;
      stripped.push(char);
    } else if (char === '/' && stringsOpen === 0 && code[index] === '/') {
      advance('\n');
    } else if (char === '/' && stringsOpen === 0 && code[index] === '*') {
      index += 1;
      commentLineOpen = line;
      commentsOpen += 1;
      while (advance('*')) {
        if (code[index] === '/') {
          commentsOpen -= 1;
          index += 1;
          break;
        }
      }
    } else if (char === '*' && stringsOpen === 0 && code[index] === '/') {
      commentLineOpen = line;
      commentsOpen -= 1;
    } else {
      if (char === '\n') line += 1;
      stripped.push(char);
    }
  }

  const text = stripped.join('');
  if (commentsOpen === 0) return { code: text };
  return { code: text, error: { message: 'Block comment mismatch', line: commentLineOpen } };
}
