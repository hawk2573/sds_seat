import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {PlanSelection} from '../src/components/PlanSelection';
import {PrintPlans} from '../src/components/PrintPlans';
import {planMatchesArea, selectPlans, spacesForPlans} from '../src/services/planSelection';
import {Assignment, FloorPlan, FloorPlanGeometry, Space} from '../src/types/domain';

const zone = (id: string, parentSpaceId?: string): Space => ({id, name: id, parentSpaceId, type: 'Zone', active: true, assignable: false, assignmentMode: 'non-occupancy', assignmentCapacity: 0});
const workstation = (id: string, parentSpaceId: string): Space => ({...zone(id, parentSpaceId), type: 'Desk / Workstation', shortLabel: id, assignable: true, assignmentMode: 'exclusive', assignmentCapacity: 1});
const spaces = [zone('mdes'), zone('faculty'), zone('phd'), zone('nested', 'mdes'), workstation('M07', 'nested'), workstation('P07', 'phd')];
const index = new Map(spaces.map(space => [space.id, space]));
const plans: FloorPlan[] = [
  {id: 'whole', name: 'Whole floor', active: true},
  ...['mdes', 'faculty', 'phd'].map(id => ({id, name: id, zoneId: id, active: true, file: {url: `${id}.png`, filename: `${id}.png`, width: id === 'faculty' ? 1140 : 880, height: id === 'faculty' ? 880 : 1140}})),
];
const shape = (id: string, floorPlanId: string, spaceId: string): FloorPlanGeometry => ({id, floorPlanId, spaceId, type: 'rectangle', x: 0.2, y: 0.3, width: 0.1, height: 0.03, rotation: 0, visible: true, locked: false, zIndex: 0});
const geometry = [shape('m', 'mdes', 'M07'), shape('p', 'phd', 'P07'), shape('shared', 'faculty', 'P07')];

describe('independent zone plans', () => {
  it('defaults to zone sheets, preserves an explicit empty selection, and drops stale IDs', () => {
    expect(selectPlans(plans).map(plan => plan.id)).toEqual(['mdes', 'faculty', 'phd']);
    expect(selectPlans(plans, [])).toEqual([]);
    expect(selectPlans(plans, ['mdes', 'deleted']).map(plan => plan.id)).toEqual(['mdes']);
    expect(selectPlans([plans[0]])).toEqual([plans[0]]);
  });
  it('matches nested workspace areas and retains the full-floor plan as context', () => {
    expect(planMatchesArea(plans[1], 'nested', index)).toBe(true);
    expect(planMatchesArea({...plans[1], zoneId: 'nested'}, 'mdes', index)).toBe(true);
    expect(planMatchesArea(plans[3], 'mdes', index)).toBe(false);
    expect(planMatchesArea(plans[0], 'mdes', index)).toBe(true);
    expect(planMatchesArea(plans[3], '__unzoned__', index)).toBe(false);
  });
  it('scopes desks through nested hierarchy and counts shared geometry only once', () => {
    expect(spacesForPlans(spaces, [plans[1]], geometry, index).map(space => space.id)).toEqual(['mdes', 'nested', 'M07']);
    expect(spacesForPlans(spaces, [plans[2], plans[3]], geometry, index).filter(space => space.assignable).map(space => space.id)).toEqual(['P07']);
    expect(spacesForPlans(spaces, [], geometry, index)).toEqual([]);
    expect(spacesForPlans(spaces, [plans[0]], geometry, index)).toEqual(spaces);
  });
  it('does not expose unrelated desks for a missing zone link', () => {
    expect(spacesForPlans(spaces, [{...plans[1], id: 'unknown', zoneId: 'deleted'}], geometry, index)).toEqual([]);
  });
  it('renders checked choices from the selection without checking every sheet', () => {
    const markup = renderToStaticMarkup(<PlanSelection plans={plans} selectedIds={['mdes', 'phd']} onChange={() => undefined} />);
    expect(markup.match(/checked=""/g)).toHaveLength(2);
    expect(markup).toContain('2 selected');
    expect(markup).toContain('Select all');
  });
  it('prints only selected sheets, with independent orientations and no view controls', () => {
    const markup = renderToStaticMarkup(<PrintPlans plans={[plans[1], plans[2]]} spaces={spaces} spacesById={index} geometry={geometry} assignments={[]} asOfDate="2026-09-07" availableOnly={false} />);
    expect(markup.match(/class="print-plan /g)).toHaveLength(2);
    expect(markup).toContain('print-plan portrait');
    expect(markup).toContain('print-plan landscape');
    expect(markup).toContain('mdes.png');
    expect(markup).not.toContain('phd.png');
    expect(markup).not.toContain('Zoom');
    expect(markup).toContain('P07');
    expect(markup).toContain('Uncolored source desks do not indicate availability');
  });
  it('uses current assignments for print status and applies the availability range', () => {
    const assignments = [{id: 'a', spaceId: 'M07', startDate: '2026-09-01', expectedEndDate: '2026-12-01', relationshipType: 'Primary Desk Holder', consumesCapacity: true, status: 'Active'}] as Assignment[];
    const props = {plans: [plans[1]], spaces, spacesById: index, geometry, assignments, asOfDate: '2026-09-07'};
    expect(renderToStaticMarkup(<PrintPlans {...props} availableOnly={false} />)).toContain('map-occupied');
    expect(renderToStaticMarkup(<PrintPlans {...props} availableOnly={true} rangeEnd="2026-09-30" />)).not.toContain('map-occupied');
  });
});
