import {FloorPlanGeometry, Point, Space} from '../types/domain';
import {normalizeSpaceKind} from './spaceHierarchy';

/** Large zone outlines must never intercept clicks intended for individual seats. */
export function orderMapGeometry(geometry: readonly FloorPlanGeometry[], spacesById: ReadonlyMap<string, Space>): FloorPlanGeometry[] {
  const layer = (item: FloorPlanGeometry) => {
    const space = item.spaceId ? spacesById.get(item.spaceId) : undefined;
    return normalizeSpaceKind(space?.type) === 'zone' ? 0 : space && !space.assignable ? 1 : 2;
  };
  return [...geometry].sort((a, b) => layer(a) - layer(b) || a.zIndex - b.zIndex);
}

export function clampNormalized(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function normalizedToViewport(point: Point, width: number, height: number): Point {
  return {x: point.x * width, y: point.y * height};
}

export function viewportToNormalized(point: Point, width: number, height: number): Point {
  return {x: clampNormalized(point.x / width), y: clampNormalized(point.y / height)};
}

export function geometryBounds(geometry: FloorPlanGeometry, width: number, height: number) {
  return {
    x: geometry.x * width,
    y: geometry.y * height,
    width: geometry.width * width,
    height: geometry.height * height,
  };
}

export function moveGeometry(geometry: FloorPlanGeometry, delta: Point, viewportWidth: number, viewportHeight: number, grid = 0): FloorPlanGeometry {
  let x = geometry.x + delta.x / viewportWidth;
  let y = geometry.y + delta.y / viewportHeight;
  if (grid > 0) {
    x = Math.round(x / grid) * grid;
    y = Math.round(y / grid) * grid;
  }
  let dx = clampNormalized(x) - geometry.x;
  let dy = clampNormalized(y) - geometry.y;
  if (geometry.type === 'polygon' && geometry.points?.length) {
    dx = Math.max(-Math.min(...geometry.points.map(point => point.x)), Math.min(1 - Math.max(...geometry.points.map(point => point.x)), dx));
    dy = Math.max(-Math.min(...geometry.points.map(point => point.y)), Math.min(1 - Math.max(...geometry.points.map(point => point.y)), dy));
  }
  return {...geometry, x: geometry.x + dx, y: geometry.y + dy,
    points: geometry.points?.map(point => ({x: point.x + dx, y: point.y + dy})),
    labelX: geometry.labelX === undefined ? undefined : geometry.labelX + dx,
    labelY: geometry.labelY === undefined ? undefined : geometry.labelY + dy,
    dirty: true};
}

export function serializePolygon(points: Point[] | undefined): string {
  return JSON.stringify((points || []).map(point => ({x: clampNormalized(point.x), y: clampNormalized(point.y)})));
}

export function parsePolygon(value: unknown): Point[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(point => typeof point?.x === 'number' && typeof point?.y === 'number')
      .map(point => ({x: clampNormalized(point.x), y: clampNormalized(point.y)}));
  } catch {
    return [];
  }
}

export function geometryTransform(geometry: FloorPlanGeometry): string {
  const centerX = geometry.x + geometry.width / 2;
  const centerY = geometry.y + geometry.height / 2;
  return `rotate(${geometry.rotation} ${centerX} ${centerY})`;
}
