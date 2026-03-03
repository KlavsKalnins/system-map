/**
 * Compute convex hull of a set of 2D points using the Graham scan algorithm.
 * Returns points in counter-clockwise order.
 * If fewer than 3 unique points, returns the input points.
 */
export function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return [...points];

  // Find bottom-most (then left-most) point
  const sorted = [...points].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const pivot = sorted[0];

  // Sort by polar angle with pivot
  const rest = sorted.slice(1).sort((a, b) => {
    const angleA = Math.atan2(a[1] - pivot[1], a[0] - pivot[0]);
    const angleB = Math.atan2(b[1] - pivot[1], b[0] - pivot[0]);
    if (angleA !== angleB) return angleA - angleB;
    // Same angle: closer point first
    const distA = (a[0] - pivot[0]) ** 2 + (a[1] - pivot[1]) ** 2;
    const distB = (b[0] - pivot[0]) ** 2 + (b[1] - pivot[1]) ** 2;
    return distA - distB;
  });

  const hull: [number, number][] = [pivot];

  for (const p of rest) {
    while (hull.length > 1) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      if (cross <= 0) hull.pop();
      else break;
    }
    hull.push(p);
  }

  return hull;
}

/**
 * Expand hull points outward by `padding` pixels from the centroid.
 */
export function expandHull(
  hull: [number, number][],
  padding: number,
): [number, number][] {
  if (hull.length === 0) return [];

  const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;

  return hull.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return [x + (dx / dist) * padding, y + (dy / dist) * padding] as [number, number];
  });
}
