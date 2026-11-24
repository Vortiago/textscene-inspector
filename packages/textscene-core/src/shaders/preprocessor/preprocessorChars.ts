export const isCharWord = (char: string | undefined): boolean =>
  char !== undefined && /^[0-9A-Za-z_]$/.test(char);

export const isCharSpace = (char: string): boolean => char === ' ' || char === '\t';

// Godot's String ends in a 0, which the preprocessor reads as a character.
export const END = '\0';

export const isCharEnd = (char: string): boolean => char === '\n' || char === END;
