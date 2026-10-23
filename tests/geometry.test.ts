import {describe, expect, it} from 'vitest';
import {geometryBounds, geometryTransform, moveGeometry, normalizedToViewport, orderMapGeometry, parsePolygon, viewportToNormalized} from '../src/services/geometry';
import {FloorPlanGeometry, Space} from '../src/types/domain';

const geometry: FloorPlanGeometry = {id: 'g1', floorPlanId: 'f1', spaceId: 's1', type: 'rectangle', x: .25, y: .5, width: .1, height: .2, rotation: 30, zIndex: 0, visible: true, locked: false};

describe('normalized geometry', () => {
  it('moves a zone polygon and its label together, preserving its outline at the page boundary', () => {
    const polygon: FloorPlanGeometry = {...geometry, type: 'polygon', x: 0.2, y: 0.3,
      points: [{x: 0.2, y: 0.3}, {x: 0.6, y: 0.3}, {x: 0.6, y: 0.7}], labelX: 0.4, labelY: 0.5};
    const moved = moveGeometry(polygon, {x: 100, y: 50}, 1000, 500);
    expect(moved.points?.[0].x).toBeCloseTo(0.3);
    expect(moved.points?.[0].y).toBeCloseTo(0.4);
    expect(moved.labelX).toBeCloseTo(0.5);
    expect(moved.labelY).toBeCloseTo(0.6);
    const clamped = moveGeometry(polygon, {x: 1000, y: 1000}, 1000, 500);
    expect(clamped.points?.[2]).toEqual({x: 1, y: 1});
    expect(clamped.points![1].x - clamped.points![0].x).toBeCloseTo(0.4);
  });
  it('draws zones behind rooms and desks even when the zone has a higher Z Index', () => {
    const defaults = {active: true, assignmentMode: 'exclusive' as const, assignmentCapacity: 1};
    const spaces: Space[] = [
      {...defaults, id: 'zone', name: 'Shared area', type: 'Zone', assignable: false},
      {...defaults, id: 'room', name: 'Office', type: 'Room', assignable: false},
      {...defaults, id: 'desk', name: 'Desk', type: 'Desk', assignable: true},
    ];
    const shapes = [
      {...geometry, id: 'desk-shape', spaceId: 'desk', zIndex: 0},
      {...geometry, id: 'zone-shape', spaceId: 'zone', zIndex: 999},
      {...geometry, id: 'room-shape', spaceId: 'room', zIndex: 100},
    ];
    expect(orderMapGeometry(shapes, new Map(spaces.map(space => [space.id, space]))).map(item => item.id))
      .toEqual(['zone-shape', 'room-shape', 'desk-shape']);
    expect(shapes[0].id).toBe('desk-shape');
  });
  it('converts between source-independent and viewport coordinates', () => {
    expect(normalizedToViewport({x: .25, y: .5}, 1000, 600)).toEqual({x: 250, y: 300});
    expect(viewportToNormalized({x: 250, y: 300}, 1000, 600)).toEqual({x: .25, y: .5});
  });
  it('stays proportional after viewport resize', () => {
    expect(geometryBounds(geometry, 1000, 500)).toEqual({x: 250, y: 250, width: 100, height: 100});
    expect(geometryBounds(geometry, 500, 1000)).toEqual({x: 125, y: 500, width: 50, height: 200});
  });
  it('moves and clamps geometry', () => {
    expect(moveGeometry(geometry, {x: 100, y: -100}, 1000, 500)).toMatchObject({x: .35, y: .3, dirty: true});
    expect(moveGeometry(geometry, {x: -1000, y: 1000}, 1000, 500)).toMatchObject({x: 0, y: 1});
  });
  it('parses polygons safely', () => {
    expect(parsePolygon('[{"x":0.1,"y":0.2},{"x":2,"y":-1}]')).toEqual([{x: .1, y: .2}, {x: 1, y: 0}]);
    expect(parsePolygon('not-json')).toEqual([]);
  });
  it('produces a rotation around the normalized center', () => expect(geometryTransform(geometry)).toContain('rotate(30'));
});
