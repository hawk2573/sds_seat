import {describe, expect, it} from 'vitest';
import {fitPlanRect, isFloorPlanImage, pointOnPlan} from '../src/services/floorPlan';

describe('floor-plan alignment', () => {
  it('fits a landscape page into a wide viewport with side margins', () => {
    expect(fitPlanRect({width: 1200, height: 600}, {width: 800, height: 600}))
      .toEqual({left: 200, top: 0, width: 800, height: 600});
  });
  it('fits the same page into a narrow viewport with top and bottom margins', () => {
    expect(fitPlanRect({width: 400, height: 600}, {width: 800, height: 600}))
      .toEqual({left: 0, top: 150, width: 400, height: 300});
  });
  it('locates the same seat after viewport resize, pan, and zoom', () => {
    const source = {width: 959, height: 719};
    for (const viewport of [{width: 1200, height: 600}, {width: 400, height: 700}]) {
      const fit = fitPlanRect(viewport, source);
      const zoom = 2.5;
      const rect = {left: 100 + fit.left * zoom - 150, top: 80 + fit.top * zoom + 25, width: fit.width * zoom, height: fit.height * zoom};
      const result = pointOnPlan({x: rect.left + rect.width * 0.25, y: rect.top + rect.height * 0.8}, rect);
      expect(result?.x).toBeCloseTo(0.25);
      expect(result?.y).toBeCloseTo(0.8);
    }
  });
  it('ignores clicks in the margins instead of creating shapes at the page edge', () => {
    const rect = {left: 200, top: 100, width: 800, height: 600};
    expect(pointOnPlan({x: 150, y: 200}, rect)).toBeUndefined();
    expect(pointOnPlan({x: 250, y: 50}, rect)).toBeUndefined();
    expect(pointOnPlan({x: 1050, y: 750}, rect)).toBeUndefined();
    expect(pointOnPlan({x: 200, y: 100}, rect)).toEqual({x: 0, y: 0});
  });
  it('handles a hidden viewport and unavailable source dimensions', () => {
    expect(fitPlanRect({width: 0, height: 0})).toEqual({left: 0, top: 0, width: 0, height: 0});
    expect(pointOnPlan({x: 0, y: 0}, {left: 0, top: 0, width: 0, height: 0})).toBeUndefined();
    expect(fitPlanRect({width: 800, height: 600}, {width: NaN, height: 0}))
      .toEqual({left: 0, top: 0, width: 800, height: 600});
  });
  it('accepts an image export but keeps the PDF a reference preview', () => {
    expect(isFloorPlanImage({url: 'attachment', filename: 'PLAN.PNG'})).toBe(true);
    expect(isFloorPlanImage({url: 'attachment', filename: 'Plan', type: 'image/jpeg'})).toBe(true);
    expect(isFloorPlanImage({url: 'attachment', filename: 'Plan.pdf', type: 'application/pdf'})).toBe(false);
    expect(isFloorPlanImage(undefined)).toBe(false);
  });
});
