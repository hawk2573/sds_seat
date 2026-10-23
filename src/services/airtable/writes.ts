import {SchemaConfig} from '../../config/schema';
import {Assignment, AssignmentDraft, FloorPlanGeometry, MovePlan} from '../../types/domain';
import {geometryFields} from './dataMapper';
import {validateAssignmentEnd} from '../assignmentEngine';

function mappedField(config: SchemaConfig, table: 'assignments' | 'geometry', key: string): string | undefined {
  return config.tables[table]?.fields[key];
}

export function assignmentFields(draft: AssignmentDraft, config: SchemaConfig): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const assign = (key: string, value: unknown) => { const id = mappedField(config, 'assignments', key); if (id && value !== undefined) fields[id] = value; };
  assign('person', draft.personId ? [{id: draft.personId}] : []);
  assign('space', draft.spaceId ? [{id: draft.spaceId}] : []);
  assign('relationshipType', {name: draft.relationshipType});
  assign('startDate', draft.startDate);
  assign('expectedEndDate', draft.expectedEndDate || null);
  assign('actualEndDate', draft.actualEndDate || null);
  assign('term', draft.academicTermId ? [{id: draft.academicTermId}] : []);
  assign('status', draft.status ? {name: draft.status} : undefined);
  assign('consumesCapacity', draft.consumesCapacity);
  assign('keyRequired', draft.keyRequired || false);
  assign('cardAccessRequired', draft.cardAccessRequired || false);
  assign('notes', draft.notes || '');
  return fields;
}

function ensurePermission(result: any, action: string) {
  if (result && result.hasPermission === false) throw new Error(result.reasonDisplayString || `You do not have permission to ${action}.`);
}

export async function createAssignment(table: any, draft: AssignmentDraft, config: SchemaConfig): Promise<string> {
  const fields = assignmentFields(draft, config);
  ensurePermission(table.checkPermissionsForCreateRecord?.(fields), 'create assignments');
  return table.createRecordAsync(fields);
}

export async function updateAssignment(table: any, assignmentId: string, draft: AssignmentDraft, config: SchemaConfig): Promise<void> {
  const fields = assignmentFields(draft, config);
  ensurePermission(table.checkPermissionsForUpdateRecord?.(assignmentId, fields), 'update this assignment');
  await table.updateRecordAsync(assignmentId, fields);
}

export async function endAssignment(table: any, assignment: Assignment, endDate: string, reason: string, config: SchemaConfig): Promise<void> {
  validateAssignmentEnd(assignment, endDate);
  const fields: Record<string, unknown> = {};
  const actualEnd = mappedField(config, 'assignments', 'actualEndDate');
  const status = mappedField(config, 'assignments', 'status');
  const current = mappedField(config, 'assignments', 'current');
  const endReason = mappedField(config, 'assignments', 'endReason');
  if (!actualEnd) throw new Error('Map the Actual End Date field before ending assignments.');
  fields[actualEnd] = endDate;
  if (status) fields[status] = {name: 'Ended'};
  if (current) fields[current] = false;
  if (endReason && reason) fields[endReason] = reason;
  ensurePermission(table.checkPermissionsForUpdateRecord?.(assignment.id, fields), 'end this assignment');
  await table.updateRecordAsync(assignment.id, fields);
}

export async function executeMove(table: any, existing: Assignment, plan: MovePlan, config: SchemaConfig): Promise<{newAssignmentId: string}> {
  const closeFields: Record<string, unknown> = {};
  const actualEnd = mappedField(config, 'assignments', 'actualEndDate');
  const moveTo = mappedField(config, 'assignments', 'moveTo');
  const moveStatus = mappedField(config, 'assignments', 'moveStatus');
  if (!actualEnd) throw new Error('Map the Actual End Date field before moving assignments.');
  closeFields[actualEnd] = plan.closeOldOn;
  if (moveTo) closeFields[moveTo] = [{id: plan.toSpaceId}];
  if (moveStatus) closeFields[moveStatus] = {name: 'Completed'};
  const newFields = assignmentFields(plan.newAssignment, config);
  const moveFrom = mappedField(config, 'assignments', 'moveFrom');
  if (moveFrom) newFields[moveFrom] = [{id: plan.fromSpaceId}];
  if (moveStatus) newFields[moveStatus] = {name: 'Completed'};
  ensurePermission(table.checkPermissionsForCreateRecord?.(newFields), 'create the destination assignment');
  ensurePermission(table.checkPermissionsForUpdateRecord?.(existing.id, closeFields), 'close the source assignment');
  let newAssignmentId: string | undefined;
  try {
    newAssignmentId = await table.createRecordAsync(newFields);
    await table.updateRecordAsync(existing.id, closeFields);
    return {newAssignmentId: newAssignmentId!};
  } catch (error) {
    const suffix = newAssignmentId ? ` The destination assignment ${newAssignmentId} was created, but the source assignment may still need to be ended.` : '';
    throw new Error(`${error instanceof Error ? error.message : String(error)}${suffix}`);
  }
}

export async function saveGeometry(table: any, items: FloorPlanGeometry[], config: SchemaConfig,
  onSaved?: (items: Array<{localId: string; saved: FloorPlanGeometry}>) => void): Promise<void> {
  const existing = items.filter(item => !item.isNew && item.dirty);
  const created = items.filter(item => item.isNew);
  for (const item of created) ensurePermission(table.checkPermissionsForCreateRecord?.(geometryFields(item, config)), 'create map shapes');
  for (const item of existing) ensurePermission(table.checkPermissionsForUpdateRecord?.(item.id, geometryFields(item, config)), 'update map shapes');
  for (let index = 0; index < created.length; index += 50) {
    const batch = created.slice(index, index + 50);
    const ids: string[] = await table.createRecordsAsync(batch.map(item => ({fields: geometryFields(item, config)})));
    // Acknowledge each completed batch immediately, so a failed later batch can
    // be retried without creating the first batch's shapes again.
    onSaved?.(batch.map((item, offset) => ({localId: item.id, saved: {...item, id: ids[offset], isNew: false, dirty: false}})));
  }
  for (let index = 0; index < existing.length; index += 50) {
    const batch = existing.slice(index, index + 50);
    await table.updateRecordsAsync(batch.map(item => ({id: item.id, fields: geometryFields(item, config)})));
    onSaved?.(batch.map(item => ({localId: item.id, saved: {...item, dirty: false}})));
  }
}
