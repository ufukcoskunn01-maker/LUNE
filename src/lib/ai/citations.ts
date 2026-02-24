const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

export function extractCitationIds(text: string): string[] {
  const found = text.match(UUID_RE) || [];
  return Array.from(new Set(found.map((item) => item.toLowerCase())));
}

export function toPgVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
