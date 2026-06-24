export function matchesText(idea: { titolo: string; keyword?: string | null }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return idea.titolo.toLowerCase().includes(q) || (idea.keyword ?? "").toLowerCase().includes(q);
}
