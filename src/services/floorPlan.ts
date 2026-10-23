import {FloorPlan, Point} from '../types/domain';

export interface Size {width: number; height: number}
export interface PlanRect extends Size {left: number; top: number}

export function isFloorPlanImage(file: FloorPlan['file']): boolean {
  return !!file && (/^image\/(png|jpeg|svg\+xml|webp)$/i.test(file.type || '')
    || /\.(png|jpe?g|svg|webp)$/i.test(file.filename));
}

/** Fit the source page once; the image and every shape share this same rectangle. */
export function fitPlanRect(viewport: Size, source?: Size): PlanRect {
  if (viewport.width <= 0 || viewport.height <= 0) return {left: 0, top: 0, width: 0, height: 0};
  if (!source || !Number.isFinite(source.width) || !Number.isFinite(source.height) || source.width <= 0 || source.height <= 0) {
    return {left: 0, top: 0, ...viewport};
  }
  const scale = Math.min(viewport.width / source.width, viewport.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  return {left: (viewport.width - width) / 2, top: (viewport.height - height) / 2, width, height};
}

/** The DOM rectangle already includes page fitting, pan, and zoom. Ignore its margins. */
export function pointOnPlan(point: Point, rect: PlanRect): Point | undefined {
  if (rect.width <= 0 || rect.height <= 0) return undefined;
  const x = (point.x - rect.left) / rect.width;
  const y = (point.y - rect.top) / rect.height;
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? {x, y} : undefined;
}
