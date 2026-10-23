import {Assignment, FloorPlan, FloorPlanGeometry, Person, Space, ValidationIssue} from '../types/domain';
import {dateValue, getSpaceAvailability, assignmentRange, assignmentConsumesCapacity, isAssignmentOperational, isValidDate} from './assignmentEngine';
import {createSpaceIndex, getEffectiveBuilding, getEffectiveLevel, normalizeSpaceKind} from './spaceHierarchy';

function duplicates<T>(items: T[], value: (item: T) => string | undefined): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = value(item)?.trim().toLowerCase();
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) || []), item]);
  }
  return new Map([...grouped].filter(([, records]) => records.length > 1));
}

function sameLocationValue(left?: string, right?: string): boolean {
  return left?.trim().toLowerCase() === right?.trim().toLowerCase();
}

function addHierarchyDiagnostics(spaces: Space[], issues: ValidationIssue[]): void {
  const spacesById = createSpaceIndex(spaces);

  for (const space of spaces) {
    if (normalizeSpaceKind(space.type) === 'zone' && !space.programUnitId) {
      issues.push({
        code: 'zone-missing-owner',
        severity: 'warning',
        message: `${space.name} is a Zone without a Zone owner.`,
        relatedRecordIds: [space.id],
      });
    }

    if (!space.parentSpaceId) continue;
    const parent = spacesById.get(space.parentSpaceId);
    if (!parent) {
      issues.push({
        code: 'hierarchy-missing-parent',
        severity: space.assignable ? 'error' : 'warning',
        message: `${space.name} links to a missing parent Space.`,
        relatedRecordIds: [space.id, space.parentSpaceId],
      });
      continue;
    }

    const childBuilding = getEffectiveBuilding(space, spacesById);
    const parentBuilding = getEffectiveBuilding(parent, spacesById);
    const childLevel = getEffectiveLevel(space, spacesById);
    const parentLevel = getEffectiveLevel(parent, spacesById);
    const mismatches: string[] = [];
    if (childBuilding && parentBuilding && !sameLocationValue(childBuilding, parentBuilding)) mismatches.push('Building');
    if (childLevel && parentLevel && !sameLocationValue(childLevel, parentLevel)) mismatches.push('Floor');
    if (mismatches.length) {
      issues.push({
        code: 'hierarchy-cross-level',
        severity: 'error',
        message: `${space.name} and its parent ${parent.name} have different ${mismatches.join(' and ')} values.`,
        relatedRecordIds: [space.id, parent.id],
      });
    }
  }

  const reportedCycles = new Set<string>();
  for (const origin of spaces) {
    const path: Space[] = [];
    const pathIndexes = new Map<string, number>();
    let current: Space | undefined = origin;
    while (current) {
      const existingIndex = pathIndexes.get(current.id);
      if (existingIndex !== undefined) {
        const cycle = path.slice(existingIndex);
        const key = cycle.map(item => item.id).sort().join('|');
        if (!reportedCycles.has(key)) {
          reportedCycles.add(key);
          issues.push({
            code: 'hierarchy-cycle',
            severity: 'error',
            message: `Parent Space cycle found: ${cycle.map(item => item.name).join(' -> ')} -> ${cycle[0].name}.`,
            relatedRecordIds: cycle.map(item => item.id),
          });
        }
        break;
      }
      pathIndexes.set(current.id, path.length);
      path.push(current);
      current = current.parentSpaceId ? spacesById.get(current.parentSpaceId) : undefined;
    }
  }

  for (const workstation of spaces.filter(space => normalizeSpaceKind(space.type) === 'workstation')) {
    const parent = workstation.parentSpaceId ? spacesById.get(workstation.parentSpaceId) : undefined;
    let problem: string | undefined;
    if (!workstation.parentSpaceId) problem = 'has no parent Workspace Area';
    else if (!parent) problem = 'has a parent link that cannot be resolved';
    else if (normalizeSpaceKind(parent.type) === 'zone') problem = undefined;
    else if (normalizeSpaceKind(parent.type) === 'room') {
      const zone = parent.parentSpaceId ? spacesById.get(parent.parentSpaceId) : undefined;
      if (!zone || normalizeSpaceKind(zone.type) !== 'zone') problem = `must resolve through parent Room ${parent.name} to a Zone`;
    } else problem = `must have a Zone or Room as its parent, not ${parent.name}`;
    if (problem) {
      issues.push({
        code: 'workstation-hierarchy',
        severity: 'warning',
        message: `${workstation.name} ${problem}.`,
        relatedRecordIds: [workstation.id, workstation.parentSpaceId, parent?.parentSpaceId].filter((id): id is string => Boolean(id)),
      });
    }
  }
}

export function runDiagnostics(
  spaces: Space[], people: Person[], assignments: Assignment[], floorPlans: FloorPlan[], geometry: FloorPlanGeometry[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const pushDuplicates = <T extends {id: string}>(records: Map<string, T[]>, code: string, label: string) => {
    for (const [value, matches] of records) issues.push({code, severity: 'error', message: `Duplicate ${label}: ${value}`, relatedRecordIds: matches.map(item => item.id)});
  };
  pushDuplicates(duplicates(spaces, item => item.spaceId), 'duplicate-space-id', 'Space ID');
  pushDuplicates(duplicates(people, item => item.personId), 'duplicate-person-id', 'Person ID');
  pushDuplicates(duplicates(people, item => item.email), 'duplicate-email', 'email');
  addHierarchyDiagnostics(spaces, issues);
  const spaceIds = new Set(spaces.map(item => item.id));
  const personIds = new Set(people.map(item => item.id));
  const floorPlanIds = new Set(floorPlans.map(item => item.id));
  for (const assignment of assignments) {
    if (!assignment.personId) issues.push({code: 'assignment-missing-person', severity: 'error', message: 'Assignment has no Person.', relatedRecordIds: [assignment.id]});
    else if (!personIds.has(assignment.personId)) issues.push({code: 'assignment-deleted-person', severity: 'error', message: 'Assignment links to a deleted Person.', relatedRecordIds: [assignment.id]});
    if (!assignment.spaceId) issues.push({code: 'assignment-missing-space', severity: 'error', message: 'Assignment has no Space.', relatedRecordIds: [assignment.id]});
    else if (!spaceIds.has(assignment.spaceId)) issues.push({code: 'assignment-deleted-space', severity: 'error', message: 'Assignment links to a deleted Space.', relatedRecordIds: [assignment.id]});
    if (!assignment.startDate) issues.push({code: 'assignment-missing-start', severity: 'error', message: 'Assignment has no Start Date.', relatedRecordIds: [assignment.id]});
    else if (!isValidDate(assignment.startDate)) issues.push({code: 'assignment-invalid-start', severity: 'error', message: 'Assignment has an invalid Start Date.', relatedRecordIds: [assignment.id]});
    const end = assignment.actualEndDate || assignment.expectedEndDate;
    if (end && !isValidDate(end)) issues.push({code: 'assignment-invalid-end', severity: 'error', message: 'Assignment has an invalid end date.', relatedRecordIds: [assignment.id]});
    if (assignment.startDate && end && (dateValue(end) || 0) < (dateValue(assignment.startDate) || 0)) {
      issues.push({code: 'end-before-start', severity: 'error', message: 'Assignment ends before it starts.', relatedRecordIds: [assignment.id]});
    }
  }
  const reportedSpaces = new Set<string>();
  assignments.forEach(assignment => {
    if (!assignment.spaceId || reportedSpaces.has(assignment.spaceId) || !isAssignmentOperational(assignment) || !assignmentConsumesCapacity(assignment)) return;
    const range = assignmentRange(assignment);
    if (!range) return;
    const space = spaces.find(item => item.id === assignment.spaceId);
    if (!space) return;
    const availability = getSpaceAvailability(space, assignments, range);
    if (availability.occupied > availability.capacity) {
      reportedSpaces.add(space.id);
      issues.push({code: 'overlap', severity: 'error', message: `${space.name} has overlapping assignments exceeding its capacity.`, relatedRecordIds: availability.conflicts.map(item => item.id)});
    }
  });
  for (const item of geometry) {
    if (!item.spaceId) issues.push({code: 'geometry-missing-space', severity: 'error', message: 'Mapped geometry has no Space.', relatedRecordIds: [item.id]});
    else if (!spaceIds.has(item.spaceId)) issues.push({code: 'geometry-deleted-space', severity: 'error', message: 'Geometry links to a deleted Space.', relatedRecordIds: [item.id]});
    if (!floorPlanIds.has(item.floorPlanId)) issues.push({code: 'geometry-deleted-plan', severity: 'error', message: 'Geometry links to a missing Floor Plan.', relatedRecordIds: [item.id]});
  }
  for (const plan of floorPlans) if (!plan.file) issues.push({code: 'plan-missing-file', severity: 'warning', message: `${plan.name} has no plan file.`, relatedRecordIds: [plan.id]});
  const mapped = new Set(geometry.map(item => item.spaceId).filter(Boolean));
  for (const space of spaces) if (space.assignable && space.active && !mapped.has(space.id)) issues.push({code: 'unmapped-space', severity: 'info', message: `${space.name} is assignable but not mapped.`, relatedRecordIds: [space.id]});
  return issues;
}
