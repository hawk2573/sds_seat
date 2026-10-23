import {
  AcademicTerm,
  Assignment,
  AssignmentDraft,
  AvailabilityResult,
  DateRange,
  MovePlan,
  Person,
  Space,
  ValidationIssue,
} from '../types/domain';

const NON_ACTIVE_STATUSES = new Set(['cancelled', 'canceled', 'inactive', 'void', 'declined']);
const NON_CAPACITY_RELATIONSHIPS = new Set(['steward', 'manager', 'responsible party', 'owner']);

/** Date-only values are interpreted in the base's local calendar. End dates are inclusive. */
export function dateValue(value?: string): number | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return Number(`${match[1]}${match[2]}${match[3]}`);
}

export function isValidDate(value?: string): value is string {
  if (!value || dateValue(value) === undefined) return false;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  const candidate = new Date(Date.UTC(y, m - 1, d));
  return candidate.getUTCFullYear() === y && candidate.getUTCMonth() === m - 1 && candidate.getUTCDate() === d;
}

export function getEffectiveAssignmentEnd(assignment: Pick<Assignment, 'actualEndDate' | 'expectedEndDate'>): string | undefined {
  return assignment.actualEndDate || assignment.expectedEndDate;
}

export function assignmentConsumesCapacity(assignment: Pick<Assignment, 'consumesCapacity' | 'relationshipType'>): boolean {
  return assignment.consumesCapacity && !NON_CAPACITY_RELATIONSHIPS.has(assignment.relationshipType.trim().toLowerCase());
}

export function isAssignmentOperational(assignment: Pick<Assignment, 'status'>): boolean {
  return !NON_ACTIVE_STATUSES.has((assignment.status || '').trim().toLowerCase());
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  const aStart = dateValue(a.start);
  const bStart = dateValue(b.start);
  if (aStart === undefined || bStart === undefined) return false;
  const aEnd = a.end ? dateValue(a.end) : Number.POSITIVE_INFINITY;
  const bEnd = b.end ? dateValue(b.end) : Number.POSITIVE_INFINITY;
  if (aEnd === undefined || bEnd === undefined) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

export function assignmentRange(assignment: Assignment | AssignmentDraft): DateRange | undefined {
  if (!isValidDate(assignment.startDate)) return undefined;
  const end = assignment.actualEndDate || assignment.expectedEndDate;
  if (end && (!isValidDate(end) || end < assignment.startDate)) return undefined;
  return {start: assignment.startDate, end};
}

export function getAssignmentsNeedingDateReview(assignments: Assignment[]): Assignment[] {
  return assignments.filter(item => isAssignmentOperational(item) && assignmentConsumesCapacity(item) && !assignmentRange(item));
}

export function validateAssignmentEnd(assignment: Assignment, endDate: string): void {
  if (!isValidDate(endDate)) throw new Error('Enter a valid end date in YYYY-MM-DD format.');
  if (!isValidDate(assignment.startDate)) throw new Error('Set a valid assignment Start Date in Airtable before ending this assignment.');
  if (endDate < assignment.startDate) throw new Error('The end date cannot precede the assignment start date.');
}

export function defaultAssignmentDates(terms: AcademicTerm[], asOfDate: string, selectedTermId?: string): Pick<AssignmentDraft, 'startDate' | 'expectedEndDate' | 'academicTermId'> {
  const validTerms = terms.filter(term => isValidDate(term.startDate) && isValidDate(term.endDate) && term.endDate >= term.startDate);
  const term = selectedTermId ? validTerms.find(item => item.id === selectedTermId)
    : validTerms.find(item => item.active !== false && item.startDate <= asOfDate && item.endDate >= asOfDate);
  return term ? {startDate: term.startDate, expectedEndDate: term.endDate, academicTermId: term.id} : {startDate: asOfDate};
}

export function isAssignmentActiveOnDate(assignment: Assignment, asOfDate: string): boolean {
  if (!isAssignmentOperational(assignment)) return false;
  const range = assignmentRange(assignment);
  return Boolean(range && rangesOverlap(range, {start: asOfDate, end: asOfDate}));
}

export function getAssignmentsActiveOnDate(assignments: Assignment[], asOfDate: string): Assignment[] {
  return assignments.filter(assignment => isAssignmentActiveOnDate(assignment, asOfDate));
}

export function getAssignmentsOverlappingRange(assignments: Assignment[], range: DateRange): Assignment[] {
  return assignments.filter(assignment => {
    const assignmentDates = assignmentRange(assignment);
    return isAssignmentOperational(assignment) && Boolean(assignmentDates && rangesOverlap(assignmentDates, range));
  });
}

export function indexAssignmentsBySpace(assignments: Assignment[]): Map<string, Assignment[]> {
  const index = new Map<string, Assignment[]>();
  for (const assignment of assignments) {
    if (!assignment.spaceId) continue;
    const current = index.get(assignment.spaceId) || [];
    current.push(assignment);
    index.set(assignment.spaceId, current);
  }
  return index;
}

export function indexAssignmentsByPerson(assignments: Assignment[]): Map<string, Assignment[]> {
  const index = new Map<string, Assignment[]>();
  for (const assignment of assignments) {
    if (!assignment.personId) continue;
    const current = index.get(assignment.personId) || [];
    current.push(assignment);
    index.set(assignment.personId, current);
  }
  return index;
}

export function getSpaceAvailability(
  space: Space,
  assignments: Assignment[],
  range: DateRange,
  excludeAssignmentId?: string,
): AvailabilityResult {
  if (!space.active) return {available: false, capacity: 0, occupied: 0, remaining: 0, conflicts: [], reason: 'Space is inactive'};
  if (!space.assignable || space.assignmentMode === 'non-occupancy') {
    return {available: false, capacity: 0, occupied: 0, remaining: 0, conflicts: [], reason: 'Space is not configured as assignable'};
  }
  const capacity = space.assignmentMode === 'exclusive' ? 1 : Math.max(1, space.assignmentCapacity);
  if (!isValidDate(range.start) || (range.end && (!isValidDate(range.end) || range.end < range.start))) {
    return {available: false, needsReview: true, capacity, occupied: 0, remaining: 0, conflicts: [], reason: 'Choose a valid date range.'};
  }
  const unresolved = getAssignmentsNeedingDateReview(assignments).filter(item => item.spaceId === space.id && item.id !== excludeAssignmentId);
  const conflicts = getAssignmentsOverlappingRange(assignments, range).filter(
    assignment => assignment.id !== excludeAssignmentId && assignment.spaceId === space.id && assignmentConsumesCapacity(assignment),
  );
  // Count simultaneous occupancy, rather than all assignments touching the range.
  // Starts sort before ends on the same day because both boundaries are inclusive.
  const events = conflicts.flatMap(item => {
    const dates = assignmentRange(item)!;
    return [
      {date: Math.max(dateValue(range.start)!, dateValue(dates.start)!), delta: 1},
      {date: Math.min(dateValue(range.end) ?? Infinity, dateValue(dates.end) ?? Infinity), delta: -1},
    ];
  }).sort((a, b) => a.date - b.date || b.delta - a.delta);
  let current = 0, occupied = 0;
  for (const event of events) { current += event.delta; occupied = Math.max(occupied, current); }
  if (unresolved.length) return {available: false, needsReview: true, capacity, occupied, remaining: 0, conflicts: [...conflicts, ...unresolved], reason: 'Existing assignment dates need review before availability can be confirmed.'};
  return {available: occupied < capacity, capacity, occupied, remaining: Math.max(0, capacity - occupied), conflicts};
}

export function detectAssignmentConflicts(
  draft: AssignmentDraft,
  assignments: Assignment[],
  spacesById: Map<string, Space>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const range = assignmentRange(draft);
  if (!range || !draft.spaceId || !draft.personId || !assignmentConsumesCapacity({...draft, relationshipType: draft.relationshipType})) return issues;
  const space = spacesById.get(draft.spaceId);
  if (!space) return issues;
  const availability = getSpaceAvailability(space, assignments, range, draft.id);
  if (!availability.available) {
    issues.push({
      code: availability.needsReview ? 'assignment-dates-unresolved' : 'space-capacity-exceeded',
      severity: 'error',
      message: availability.reason || `${space.name} is at capacity for part or all of this date range.`,
      relatedRecordIds: availability.conflicts.map(item => item.id),
    });
  }
  const overlappingPersonAssignments = getAssignmentsOverlappingRange(assignments, range).filter(item => {
    if (item.id === draft.id || item.personId !== draft.personId || item.spaceId === draft.spaceId || !assignmentConsumesCapacity(item)) return false;
    const otherSpace = item.spaceId ? spacesById.get(item.spaceId) : undefined;
    return otherSpace?.assignmentMode === 'exclusive';
  });
  if (space.assignmentMode === 'exclusive' && overlappingPersonAssignments.length) {
    issues.push({
      code: 'person-double-assigned',
      severity: 'warning',
      message: 'This person already has another exclusive space during the requested range.',
      relatedRecordIds: overlappingPersonAssignments.map(item => item.id),
    });
  }
  return issues;
}

export function validateAssignment(
  draft: AssignmentDraft,
  assignments: Assignment[],
  spacesById: Map<string, Space>,
  peopleById: Map<string, Person>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!draft.personId) issues.push({code: 'missing-person', severity: 'error', message: 'Select a person.'});
  if (!draft.spaceId) issues.push({code: 'missing-space', severity: 'error', message: 'Select a space.'});
  if (!draft.startDate || !isValidDate(draft.startDate)) issues.push({code: 'missing-start', severity: 'error', message: 'Enter a valid start date.'});
  const end = draft.actualEndDate || draft.expectedEndDate;
  if (end && !isValidDate(end)) issues.push({code: 'invalid-end', severity: 'error', message: 'Enter a valid end date.'});
  if (draft.startDate && end && (dateValue(end) || 0) < (dateValue(draft.startDate) || 0)) {
    issues.push({code: 'end-before-start', severity: 'error', message: 'The end date cannot precede the start date.'});
  }
  const space = draft.spaceId ? spacesById.get(draft.spaceId) : undefined;
  if (draft.spaceId && !space) issues.push({code: 'space-not-found', severity: 'error', message: 'The selected Space record no longer exists.'});
  if (space && !space.active) issues.push({code: 'inactive-space', severity: 'error', message: 'The selected Space is inactive.'});
  if (space && !space.assignable) issues.push({code: 'not-assignable', severity: 'error', message: 'The selected Space is not assignable.'});
  const person = draft.personId ? peopleById.get(draft.personId) : undefined;
  if (draft.personId && !person) issues.push({code: 'person-not-found', severity: 'error', message: 'The selected Person record no longer exists.'});
  if (person && /inactive|former|departed/i.test(person.status || '')) {
    issues.push({code: 'inactive-person', severity: 'warning', message: 'The selected person appears inactive.'});
  }
  if (person?.expectedEndDate && end && (dateValue(end) || 0) > (dateValue(person.expectedEndDate) || 0)) {
    issues.push({code: 'beyond-affiliation', severity: 'warning', message: `Assignment extends beyond the person's known end date (${person.expectedEndDate}).`});
  }
  return [...issues, ...detectAssignmentConflicts(draft, assignments, spacesById)];
}

export function previousDate(date: string): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

export function planMove(existing: Assignment, toSpaceId: string, moveDate: string): MovePlan {
  if (!existing.personId || !existing.spaceId || !existing.startDate) throw new Error('The existing assignment is incomplete and cannot be moved.');
  if (!isValidDate(moveDate)) throw new Error('Enter a valid move date.');
  if ((dateValue(moveDate) || 0) <= (dateValue(existing.startDate) || 0)) throw new Error('Move date must be after the existing assignment start date.');
  return {
    existingAssignmentId: existing.id,
    personId: existing.personId,
    fromSpaceId: existing.spaceId,
    toSpaceId,
    moveDate,
    closeOldOn: previousDate(moveDate),
    newAssignment: {
      personId: existing.personId,
      spaceId: toSpaceId,
      relationshipType: existing.relationshipType,
      startDate: moveDate,
      expectedEndDate: existing.expectedEndDate,
      academicTermId: existing.academicTermId,
      consumesCapacity: existing.consumesCapacity,
      keyRequired: existing.keyRequired,
      cardAccessRequired: existing.cardAccessRequired,
      notes: existing.notes,
    },
  };
}

export function getPersonCurrentAssignments(assignments: Assignment[], personId: string, asOfDate: string): Assignment[] {
  return getAssignmentsActiveOnDate(assignments, asOfDate).filter(item => item.personId === personId);
}

export function getPersonFutureAssignments(assignments: Assignment[], personId: string, afterDate: string): Assignment[] {
  const after = dateValue(afterDate) || 0;
  return assignments
    .filter(item => item.personId === personId && isAssignmentOperational(item) && (dateValue(item.startDate) || 0) > after)
    .sort((a, b) => (dateValue(a.startDate) || 0) - (dateValue(b.startDate) || 0));
}

export function getSpaceAssignmentHistory(assignments: Assignment[], spaceId: string): Assignment[] {
  return assignments
    .filter(item => item.spaceId === spaceId)
    .sort((a, b) => (dateValue(b.startDate) || 0) - (dateValue(a.startDate) || 0));
}
