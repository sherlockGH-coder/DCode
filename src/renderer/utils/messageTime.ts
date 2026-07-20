export function parseDbTimestamp(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : value.replace(' ', 'T') + 'Z';
  const timestamp = new Date(normalized).getTime();
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

export function formatCompletedAt(timestampMs: number | undefined): string {
  if (!timestampMs) return '';
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
