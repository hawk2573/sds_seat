import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {DetailPanel} from '../src/components/DetailPanel';
import {FloorPlanCanvas} from '../src/components/FloorPlanCanvas';
import {FloorPlanGeometry, Space} from '../src/types/domain';

function space(id: string, name: string, overrides: Partial<Space> = {}): Space {
  return {
    id,
    name,
    active: true,
    assignable: false,
    assignmentMode: 'exclusive',
    assignmentCapacity: 1,
    ...overrides,
  };
}

function geometry(id: string, spaceId?: string): FloorPlanGeometry {
  return {
    id,
    floorPlanId: 'plan',
    spaceId,
    type: 'rectangle',
    x: 0.1,
    y: 0.1,
    width: 0.1,
    height: 0.1,
    rotation: 0,
    zIndex: 0,
    visible: true,
    locked: false,
  };
}

describe('hierarchy-aware space UI', () => {
  it('offers the attachment record when the selected plan is empty', () => {
    const markup = renderToStaticMarkup(<FloorPlanCanvas
      plan={{id: 'plan', name: 'Numbered Assignment Plan', active: true}}
      spaces={[]} assignments={[]} geometry={[]} asOfDate="2026-09-07" editMode={false} tool="select"
      onSelect={() => undefined} onGeometryChange={() => undefined} onCreate={() => undefined} onOpenPlan={() => undefined}
    />);
    expect(markup).toContain('Numbered Assignment Plan');
    expect(markup).toContain('Open floor-plan record');
    expect(markup).toContain('Plan File attachment field');
  });
  it('keeps a PDF preview separate from clickable geometry until an image export is attached', () => {
    const markup = renderToStaticMarkup(<FloorPlanCanvas
      plan={{id: 'plan', name: 'Plan', active: true, file: {url: 'https://example.edu/plan.pdf', filename: 'plan.pdf', type: 'application/pdf'}}}
      spaces={[space('desk', 'Workstation', {assignable: true})]} assignments={[]} geometry={[geometry('shape', 'desk')]}
      asOfDate="2026-09-07" editMode={false} tool="select"
      onSelect={() => undefined} onGeometryChange={() => undefined} onCreate={() => undefined}
    />);
    expect(markup).toContain('application/pdf');
    expect(markup).toContain('add a PNG or JPG export');
    expect(markup).not.toContain('geometry-layer');
  });
  it('shows the rooms within a zone without treating the zone as an assignable desk', () => {
    const zone = space('zone', 'Shared & Administrative', {type: 'Zone'});
    const room = space('room', 'Meeting Room', {type: 'Room', parentSpaceId: zone.id});
    const markup = renderToStaticMarkup(<DetailPanel space={zone} assignments={[]} spacesById={new Map([[zone.id, zone], [room.id, room]])}
      peopleById={new Map()} programsById={new Map()} asOfDate="2026-09-07" readOnly={false}
      onSelectSpace={() => undefined} onClose={() => undefined} onAssign={() => undefined} onMove={() => undefined} onEnd={() => undefined}
    />);
    expect(markup).toContain('In this area');
    expect(markup).toContain('Meeting Room');
    expect(markup).not.toContain('Assign person');
  });
  it('shows an office occupant even when the office itself is not configured for new desk assignments', () => {
    const office = space('room', 'Faculty Office', {type: 'Room'});
    const markup = renderToStaticMarkup(<DetailPanel space={office}
      assignments={[{id: 'a', spaceId: office.id, personId: 'p', relationshipType: 'Occupant', startDate: '2026-08-17', expectedEndDate: '2026-12-12', consumesCapacity: true}]}
      spacesById={new Map([[office.id, office]])} peopleById={new Map([['p', {id: 'p', name: 'Example Faculty Member'}]])}
      programsById={new Map()} asOfDate="2026-09-07" readOnly
      onClose={() => undefined} onAssign={() => undefined} onMove={() => undefined} onEnd={() => undefined}
    />);
    expect(markup).toContain('Example Faculty Member');
    expect(markup).toContain('Assignment history');
    expect(markup).not.toContain('Assign person');
  });
  it.each([false, true])('marks an undated assignment for review and excludes it from available results (map=%s)', withPlan => {
    const desk = space('desk', 'Uncertain workstation', {assignable: true});
    const props = {
      plan: withPlan ? {id: 'plan', name: 'Plan', active: true, file: {url: 'https://example.edu/plan.png', filename: 'plan.png'}} : undefined,
      spaces: [desk], assignments: [{id: 'a', spaceId: desk.id, personId: 'p', relationshipType: 'Occupant', consumesCapacity: true}],
      geometry: [geometry('shape', desk.id)], asOfDate: '2026-09-04', editMode: false, tool: 'select' as const,
      onSelect: () => undefined, onGeometryChange: () => undefined, onCreate: () => undefined,
    };
    const all = renderToStaticMarkup(<FloorPlanCanvas {...props} />);
    expect(all).toContain(withPlan ? 'map-issue' : 'Needs review');
    expect(renderToStaticMarkup(<FloorPlanCanvas {...props} availableOnly />)).not.toContain('Uncertain workstation');
    const detail = renderToStaticMarkup(<DetailPanel space={desk} assignments={props.assignments} spacesById={new Map([[desk.id, desk]])} peopleById={new Map()} programsById={new Map()} asOfDate="2026-09-04" readOnly={false} onClose={() => undefined} onAssign={() => undefined} onMove={() => undefined} onEnd={() => undefined} />);
    expect(detail).toContain('Needs review');
    expect(detail).not.toContain('No one is assigned on this date.');
  });
  it('hides valid linked geometry outside the active filter but keeps broken links visible', () => {
    const shown = space('shown', 'Shown workstation', {assignable: true});
    const hidden = space('hidden', 'Hidden workstation', {assignable: true});
    const markup = renderToStaticMarkup(<FloorPlanCanvas
      plan={{id: 'plan', name: 'Floor plan', active: true, file: {url: 'https://example.edu/plan.png', filename: 'plan.png', type: 'image/png'}}}
      spaces={[shown, hidden]}
      assignments={[]}
      geometry={[geometry('shown-shape', shown.id), geometry('hidden-shape', hidden.id), geometry('deleted-shape', 'deleted-space'), geometry('unlinked-shape')]}
      visibleSpaceIds={new Set([shown.id])}
      asOfDate="2026-09-02"
      availableOnly
      editMode={false}
      tool="select"
      onSelect={() => undefined}
      onGeometryChange={() => undefined}
      onCreate={() => undefined}
    />);

    expect(markup).toContain('Shown workstation');
    expect(markup).not.toContain('Hidden workstation');
    expect(markup).toContain('Unlinked geometry');
  });

  it('shows a usable workstation list when the floor-plan image is unavailable', () => {
    const desk = space('desk', 'MDes Desk 007', {type: 'Desk / Workstation', assignable: true, spaceId: 'KI-L2-MDES-007'});
    const otherFloor = space('other', 'Other Desk', {type: 'Desk / Workstation', assignable: true});
    const markup = renderToStaticMarkup(<FloorPlanCanvas
      spaces={[desk, otherFloor]}
      assignments={[]}
      geometry={[]}
      visibleSpaceIds={new Set([desk.id])}
      asOfDate="2026-09-02"
      editMode={false}
      tool="select"
      onSelect={() => undefined}
      onGeometryChange={() => undefined}
      onCreate={() => undefined}
    />);

    expect(markup).toContain('Workstation list');
    expect(markup).toContain('1 workstation');
    expect(markup).toContain('MDes Desk 007');
    expect(markup).toContain('Available');
    expect(markup).not.toContain('Other Desk');
    expect(markup).toContain('No floor-plan record is configured');
  });

  it('shows the zone hierarchy and inherited zone owner for a workstation', () => {
    const zone = space('zone', 'MDes Zone', {type: 'Zone', programUnitId: 'mdes'});
    const room = space('room', 'Studio 201', {type: 'Room', parentSpaceId: zone.id});
    const workstation = space('desk', 'Workstation 12', {type: 'Desk / Workstation', parentSpaceId: room.id, assignable: true});
    const spacesById = new Map([zone, room, workstation].map(item => [item.id, item]));
    const markup = renderToStaticMarkup(<DetailPanel
      space={workstation}
      assignments={[]}
      spacesById={spacesById}
      peopleById={new Map()}
      programsById={new Map([['mdes', {id: 'mdes', name: 'Master of Design'}]])}
      asOfDate="2026-09-02"
      readOnly={false}
      onClose={() => undefined}
      onAssign={() => undefined}
      onMove={() => undefined}
      onEnd={() => undefined}
    />);

    expect(markup).toContain('MDes Zone › Studio 201 › Workstation 12');
    expect(markup).toContain('Area owner');
    expect(markup).toContain('Master of Design');
    expect(markup).toContain('Assign person');
  });

  it('does not offer assignment for inactive or nonassignable spaces', () => {
    for (const selected of [
      space('zone', 'Zone', {type: 'Zone'}),
      space('inactive', 'Inactive workstation', {type: 'Desk / Workstation', active: false, assignable: true}),
    ]) {
      const markup = renderToStaticMarkup(<DetailPanel
        space={selected}
        assignments={[]}
        spacesById={new Map([[selected.id, selected]])}
        peopleById={new Map()}
        programsById={new Map()}
        asOfDate="2026-09-02"
        readOnly={false}
        onClose={() => undefined}
        onAssign={() => undefined}
        onMove={() => undefined}
        onEnd={() => undefined}
      />);
      expect(markup).not.toContain('Assign person');
      if (!selected.assignable) expect(markup).not.toContain('No one is assigned on this date.');
    }
  });
});
