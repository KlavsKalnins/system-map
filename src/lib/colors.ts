import type { Category } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'economic', label: 'Economic', color: '#3b82f6' },
  { id: 'social', label: 'Social', color: '#a855f7' },
  { id: 'environmental', label: 'Environmental', color: '#22c55e' },
  { id: 'political', label: 'Political', color: '#ef4444' },
  { id: 'technological', label: 'Technological', color: '#f59e0b' },
];

export function getCategoryColor(
  categories: Category[],
  categoryId: string,
): string {
  return categories.find((c) => c.id === categoryId)?.color ?? '#6b7280';
}
