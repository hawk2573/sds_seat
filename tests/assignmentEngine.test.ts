import {describe, expect, it} from 'vitest';
import {
  detectAssignmentConflicts,
  defaultAssignmentDates,
  getEffectiveAssignmentEnd,
  getSpaceAvailability,
  isAssignmentActiveOnDate,
  planMove,
  rangesOverlap,
  validateAssignment,
} from '../src/services/assignmentEngine';
import {Assignment, AssignmentDraft, Person, Space} from '../src/types/domain';

const desk: Space = {id: 'desk-a', name: 'Desk A', active: true, assignable: true, assignmentMode: 'exclusive', assignmentCapacity: 1};
const shared: Space = {...desk, id: 'studio', name: 'Studio', assignmentMode: 'shared', assignmentCapacity: 2};
const person: Person = {id: 'p1', name: 'Jordan Smith', expectedEndDate: '2027-05-15'};

function assignment(overrides: Partial<Assignment> = {}): Assignment {
  return {id: 'a1', personId: 'p1', spaceId: 'desk-a', relationshipType: 'Occupant', startDate: '2026-08-24', expectedEndDate: '2026-12-18', consumesCapacity: true, ...overrides};
}

describe('date-aware assignment logic', () => {
  it('includes both start and end dates', () => {
    const value = assignment();
    expect(isAssignmentActiveOnDate(value, '2026-08-24')).toBe(true);
    expect(isAssignmentActiveOnDate(value, '2026-12-18')).toBe(true);
    expect(isAssignmentActiveOnDate(value, '2026-12-19')).toBe(false);
  });
  it('supports open-ended assignments', () => expect(isAssignmentActiveOnDate(assignment({expectedEndDate: undefined}), '2099-01-01')).toBe(true));
  it('uses actual end in preference to expected end', () => {
    const value = assignment({actualEndDate: '2026-10-01'});
    expect(getEffectiveAssignmentEnd(value)).toBe('2026-10-01');
    expect(isAssignmentActiveOnDate(value, '2026-10-02')).toBe(false);
  });
  it('excludes future and canceled assignments', () => {
    expect(isAssignmentActiveOnDate(assignment(), '2026-08-01')).toBe(false);
    expect(isAssignmentActiveOnDate(assignment({status: 'Canceled'}), '2026-09-01')).toBe(false);
  });
  it('treats end dates as inclusive when finding overlap', () => {
    expect(rangesOverlap({start: '2026-01-01', end: '2026-01-31'}, {start: '2026-01-31', end: '2026-02-10'})).toBe(true);
    expect(rangesOverlap({start: '2026-01-01', end: '2026-01-30'}, {start: '2026-01-31'})).toBe(false);
  });
});

describe('conflict and capacity logic', () => {
  it.each([undefined, '2026-02-30', '2026-08-24garbage'])('withholds availability for unresolved start date %s', startDate => {
    const unresolved = assignment({startDate});
    const result = getSpaceAvailability(desk, [unresolved], {start: '2026-09-01'});
    expect(result).toMatchObject({available: false, needsReview: true, remaining: 0});
    expect(detectAssignmentConflicts({...assignment(), id: undefined}, [unresolved], new Map([[desk.id, desk]])))
      .toContainEqual(expect.objectContaining({code: 'assignment-dates-unresolved', severity: 'error'}));
  });
  it('does not let canceled or stewardship records with missing dates block a desk', () => {
    const result = getSpaceAvailability(desk, [assignment({startDate: undefined, status: 'Cancelled'}), assignment({id: 'steward', startDate: undefined, relationshipType: 'Steward'})], {start: '2026-09-01'});
    expect(result.available).toBe(true);
  });
  it('withholds availability for invalid effective end dates and reversed ranges', () => {
    for (const expectedEndDate of ['2026-02-30', '2026-01-01']) {
      expect(getSpaceAvailability(desk, [assignment({expectedEndDate})], {start: '2026-09-01'})).toMatchObject({available: false, needsReview: true});
    }
    expect(getSpaceAvailability(desk, [], {start: '2026-09-30', end: '2026-09-01'}).available).toBe(false);
  });
  it('counts peak simultaneous occupancy over a range instead of adding sequential assignments', () => {
    const sequential = [assignment({spaceId: shared.id, startDate: '2026-09-01', expectedEndDate: '2026-09-10'}), assignment({id: 'a2', spaceId: shared.id, startDate: '2026-09-11', expectedEndDate: '2026-09-20'})];
    expect(getSpaceAvailability(shared, sequential, {start: '2026-09-01', end: '2026-09-30'})).toMatchObject({available: true, occupied: 1, remaining: 1});
    sequential[1].startDate = '2026-09-10';
    expect(getSpaceAvailability(shared, sequential, {start: '2026-09-01', end: '2026-09-30'})).toMatchObject({available: false, occupied: 2});
  });
  it('blocks new capacity-consuming assignments when shared capacity is full', () => {
    const full = [assignment({spaceId: shared.id}), assignment({id: 'a2', personId: 'p2', spaceId: shared.id})];
    expect(detectAssignmentConflicts({...assignment({spaceId: shared.id}), id: undefined}, full, new Map([[shared.id, shared]])))
      .toContainEqual(expect.objectContaining({code: 'space-capacity-exceeded', severity: 'error'}));
  });
  it('blocks overlap at a capacity-1 desk', () => {
    const result = getSpaceAvailability(desk, [assignment()], {start: '2026-09-01', end: '2026-09-30'});
    expect(result.available).toBe(false);
    expect(result.conflicts).toHaveLength(1);
  });
  it('allows non-overlapping ranges', () => expect(getSpaceAvailability(desk, [assignment()], {start: '2026-12-19'}).available).toBe(true));
  it('handles shared capacity', () => {
    const first = assignment({spaceId: 'studio'});
    const second = assignment({id: 'a2', personId: 'p2', spaceId: 'studio'});
    expect(getSpaceAvailability(shared, [first], {start: '2026-09-01'}).remaining).toBe(1);
    expect(getSpaceAvailability(shared, [first, second], {start: '2026-09-01'}).available).toBe(false);
  });
  it('does not consume capacity for stewardship', () => {
    const steward = assignment({relationshipType: 'Steward'});
    expect(getSpaceAvailability(desk, [steward], {start: '2026-09-01'}).available).toBe(true);
  });
  it('warns when a person has two exclusive primary spaces', () => {
    const draft: AssignmentDraft = {...assignment({id: undefined as unknown as string, spaceId: 'desk-b'}), id: undefined};
    const spaces = new Map([['desk-a', desk], ['desk-b', {...desk, id: 'desk-b', name: 'Desk B'}]]);
    expect(detectAssignmentConflicts(draft, [assignment()], spaces).some(issue => issue.code === 'person-double-assigned')).toBe(true);
  });
  it('flags invalid dates and affiliation overruns', () => {
    const draft: AssignmentDraft = {...assignment({expectedEndDate: '2028-01-01'}), id: undefined};
    const issues = validateAssignment(draft, [], new Map([[desk.id, desk]]), new Map([[person.id, person]]));
    expect(issues.some(issue => issue.code === 'beyond-affiliation')).toBe(true);
    expect(validateAssignment({...draft, expectedEndDate: '2025-01-01'}, [], new Map([[desk.id, desk]]), new Map([[person.id, person]])).some(issue => issue.code === 'end-before-start')).toBe(true);
  });
});

describe('semester defaults', () => {
  const terms = [{id: 'fall', name: 'Fall 2026', startDate: '2026-08-17', endDate: '2026-12-12', active: true}, {id: 'spring', name: 'Spring 2027', startDate: '2027-01-11', endDate: '2027-05-08', active: true}];
  it('uses the full current semester for a new assignment', () => {
    expect(defaultAssignmentDates(terms, '2026-09-04')).toEqual({academicTermId: 'fall', startDate: '2026-08-17', expectedEndDate: '2026-12-12'});
  });
  it('honors an explicitly selected future semester', () => {
    expect(defaultAssignmentDates(terms, '2026-09-04', 'spring')).toEqual({academicTermId: 'spring', startDate: '2027-01-11', expectedEndDate: '2027-05-08'});
  });
  it('does not invent a term or use an incomplete term', () => {
    expect(defaultAssignmentDates(terms, '2026-12-25')).toEqual({startDate: '2026-12-25'});
    expect(defaultAssignmentDates([{...terms[0], endDate: ''}], '2026-09-04')).toEqual({startDate: '2026-09-04'});
  });
});

describe('move workflow', () => {
  it('closes the old assignment and creates a linked new draft without altering the original', () => {
    const original = assignment({expectedEndDate: '2027-05-15'});
    const move = planMove(original, 'desk-b', '2027-01-11');
    expect(move.closeOldOn).toBe('2027-01-10');
    expect(move.newAssignment.startDate).toBe('2027-01-11');
    expect(move.newAssignment.spaceId).toBe('desk-b');
    expect(original.spaceId).toBe('desk-a');
    expect(original.actualEndDate).toBeUndefined();
  });
  it('prevents a move on or before the original start', () => expect(() => planMove(assignment(), 'desk-b', '2026-08-24')).toThrow());
});
