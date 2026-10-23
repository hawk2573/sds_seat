import {describe, expect, it} from 'vitest';
import {runDiagnostics} from '../src/services/diagnostics';
import {Assignment, Space} from '../src/types/domain';

function space(overrides: Partial<Space> = {}): Space {
  return {
    id: 'space-1',
    name: 'Space 1',
    active: true,
    assignable: false,
    assignmentMode: 'non-occupancy',
    assignmentCapacity: 0,
    ...overrides,
  };
}

function diagnose(spaces: Space[]) {
  return runDiagnostics(spaces, [], [], [], []);
}

describe('space hierarchy diagnostics', () => {
  it('reports shared-space overlap only when simultaneous assignments exceed capacity', () => {
    const shared = space({assignable: true, assignmentMode: 'shared', assignmentCapacity: 2});
    const assignment: Assignment = {id: 'a1', spaceId: shared.id, personId: 'p', relationshipType: 'Occupant', startDate: '2026-08-17', expectedEndDate: '2026-12-12', consumesCapacity: true};
    const records = [assignment, {...assignment, id: 'a2'}];
    const overlaps = (items: Assignment[]) => runDiagnostics([shared], [], items, [], []).filter(issue => issue.code === 'overlap');
    expect(overlaps(records)).toHaveLength(0);
    expect(overlaps([...records, {...assignment, id: 'a3'}])).toHaveLength(1);
    expect(overlaps([...records, {...assignment, id: 'canceled', status: 'Cancelled'}])).toHaveLength(0);
  });
  it('reports each parent cycle once', () => {
    const spaces = [
      space({id: 'zone', name: 'North Zone', type: 'Zone', parentSpaceId: 'room', programUnitId: 'mdes'}),
      space({id: 'room', name: 'Room 101', type: 'Room', parentSpaceId: 'zone'}),
    ];

    const cycles = diagnose(spaces).filter(issue => issue.code === 'hierarchy-cycle');
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toMatchObject({severity: 'error'});
    expect(new Set(cycles[0].relatedRecordIds)).toEqual(new Set(['zone', 'room']));
  });

  it('reports missing parents and makes an assignable orphan an error', () => {
    const issues = diagnose([
      space({id: 'room', name: 'Room 101', type: 'Room', parentSpaceId: 'deleted-zone'}),
      space({id: 'desk', name: 'Desk 1', type: 'Workstation', parentSpaceId: 'deleted-room', assignable: true}),
    ]).filter(issue => issue.code === 'hierarchy-missing-parent');

    expect(issues).toHaveLength(2);
    expect(issues.find(issue => issue.relatedRecordIds?.[0] === 'room')?.severity).toBe('warning');
    expect(issues.find(issue => issue.relatedRecordIds?.[0] === 'desk')?.severity).toBe('error');
  });

  it('blocks parent links that cross Floors or Buildings', () => {
    const issues = diagnose([
      space({id: 'zone', name: 'North Zone', type: 'Zone', building: 'KI', level: 'Level 1', programUnitId: 'phd'}),
      space({id: 'room', name: 'Room 201', type: 'Room', building: 'Other', level: 'Level 2', parentSpaceId: 'zone'}),
    ]);

    const mismatch = issues.find(issue => issue.code === 'hierarchy-cross-level');
    expect(mismatch).toMatchObject({severity: 'error', relatedRecordIds: ['room', 'zone']});
    expect(mismatch?.message).toContain('Building and Floor');
  });

  it('compares a child location with its parent inherited from the Zone', () => {
    const issues = diagnose([
      space({id: 'zone', name: 'North Zone', type: 'Zone', building: 'KI', level: 'Level 1', programUnitId: 'phd'}),
      space({id: 'room', name: 'Room 101', type: 'Room', parentSpaceId: 'zone'}),
      space({id: 'desk', name: 'Desk 1', type: 'Workstation', building: 'KI', level: 'Level 2', parentSpaceId: 'room', assignable: true}),
    ]);

    expect(issues.find(issue => issue.code === 'hierarchy-cross-level')).toMatchObject({
      severity: 'error',
      relatedRecordIds: ['desk', 'room'],
    });
  });

  it('warns when a Zone has no owner', () => {
    const issues = diagnose([
      space({id: 'unowned', name: 'Open Studio Zone', type: 'Zone'}),
      space({id: 'owned', name: 'MDes Zone', type: 'Zone', programUnitId: 'mdes'}),
    ]).filter(issue => issue.code === 'zone-missing-owner');

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({severity: 'warning', relatedRecordIds: ['unowned']});
  });

  it('accepts Zone to Workstation and Zone to Room to Workstation paths', () => {
    const spaces = [
      space({id: 'zone', name: 'MDes Zone', type: 'Zone', programUnitId: 'mdes'}),
      space({id: 'room', name: 'Room 101', type: 'Room', parentSpaceId: 'zone'}),
      space({id: 'valid-desk', name: 'Student Desk 1', type: 'Student Desk', parentSpaceId: 'room', assignable: true}),
      space({id: 'direct-desk', name: 'Faculty Desk 1', type: 'Faculty Desk', parentSpaceId: 'zone', assignable: true}),
      space({id: 'orphan-desk', name: 'Workstation 3', type: 'Workstation', assignable: true}),
    ];

    const issues = diagnose(spaces).filter(issue => issue.code === 'workstation-hierarchy');
    expect(issues.map(issue => issue.relatedRecordIds?.[0])).toEqual(['orphan-desk']);
    expect(issues.every(issue => issue.severity === 'warning')).toBe(true);
  });

  it('keeps the existing non-hierarchy checks active', () => {
    const duplicate = space({id: 'first', spaceId: 'KI-101'});
    const issues = diagnose([duplicate, {...duplicate, id: 'second'}]);
    expect(issues.some(issue => issue.code === 'duplicate-space-id')).toBe(true);
    expect(issues.filter(issue => issue.code === 'unmapped-space')).toHaveLength(0);
  });
});
