export interface LocalFileReference {
  path: string;
  line?: number;
}

function stripLocalScheme(value: string): string {
  return value.replace(/^file:\/\//, '').replace(/^local-file:\/\//, '');
}

function decodePath(value: string): string {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

export function parseLocalFileReference(input: string): LocalFileReference {
  const cleaned = decodePath(stripLocalScheme(input.trim()));

  const hashMatch = cleaned.match(/^(.*?)(?:#L|#)(\d+)$/i);
  if (hashMatch) {
    return { path: hashMatch[1], line: Number(hashMatch[2]) };
  }

  const colonMatch = cleaned.match(/^(.*):(\d+)(?::\d+)?$/);
  if (colonMatch) {
    return { path: colonMatch[1], line: Number(colonMatch[2]) };
  }

  return { path: cleaned };
}

export function stripLocalFileReferenceSuffix(input: string): string {
  return parseLocalFileReference(input).path;
}
