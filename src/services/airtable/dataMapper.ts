import {Assignment, FloorPlan, FloorPlanGeometry, Person, ProgramUnit, Space, AcademicTerm} from '../../types/domain';
import {AssignmentRules, SchemaConfig, TableRole} from '../../config/schema';
import {parsePolygon, serializePolygon} from '../geometry';
import {normalizeSpaceKind} from '../spaceHierarchy';
import {isFloorPlanImage} from '../floorPlan';

type RecordLike = {id: string; name?: string; getCellValue(fieldId: string): unknown; getCellValueAsString(fieldId: string): string};

function field(config: SchemaConfig, role: TableRole, key: string): string | undefined {
  return config.tables[role]?.fields[key];
}

function raw(record: RecordLike, fieldId?: string): unknown {
  if (!fieldId) return undefined;
  try { return record.getCellValue(fieldId); } catch { return undefined; }
}

function text(record: RecordLike, fieldId?: string): string | undefined {
  if (!fieldId) return undefined;
  try { return record.getCellValueAsString(fieldId).trim() || undefined; } catch { return undefined; }
}

function bool(record: RecordLike, fieldId?: string, fallback = false): boolean {
  const value = raw(record, fieldId);
  return typeof value === 'boolean' ? value : fallback;
}

function number(record: RecordLike, fieldId?: string, fallback = 0): number {
  const value = raw(record, fieldId);
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function linkedId(record: RecordLike, fieldId?: string): string | undefined {
  const value = raw(record, fieldId);
  if (!Array.isArray(value) || !value.length) return undefined;
  return typeof value[0]?.id === 'string' ? value[0].id : undefined;
}

function firstAttachment(record: RecordLike, fieldId?: string): FloorPlan['file'] | undefined {
  const value = raw(record, fieldId);
  if (!Array.isArray(value)) return undefined;
  const files = value.filter(item => typeof item?.url === 'string');
  // Keep the source PDF in the same attachment cell; use its image export for mapping.
  const file = files.find(item => isFloorPlanImage({...item, filename: item.filename || ''})) || files[0];
  if (!file) return undefined;
  return {url: file.url, filename: file.filename || 'Floor plan', type: file.type,
    width: typeof file.width === 'number' && file.width > 0 ? file.width : undefined,
    height: typeof file.height === 'number' && file.height > 0 ? file.height : undefined};
}

export function mapSpaces(records: RecordLike[], config: SchemaConfig): Space[] {
  return records.map(record => {
    const type = text(record, field(config, 'spaces', 'type'));
    const defaultAssignable = normalizeSpaceKind(type) === 'workstation';
    const modeText = (text(record, field(config, 'spaces', 'assignmentMode')) || '').toLowerCase();
    const assignmentMode = modeText.includes('non')
      ? 'non-occupancy'
      : modeText.includes('shared')
        ? 'shared'
        : defaultAssignable ? 'exclusive' : 'non-occupancy';
    return {
      id: record.id,
      name: text(record, field(config, 'spaces', 'name')) || record.name || 'Unnamed Space',
      spaceId: text(record, field(config, 'spaces', 'spaceId')),
      shortLabel: text(record, field(config, 'spaces', 'shortLabel')),
      type,
      building: text(record, field(config, 'spaces', 'building')),
      level: text(record, field(config, 'spaces', 'level')),
      roomNumber: text(record, field(config, 'spaces', 'roomNumber')),
      parentSpaceId: linkedId(record, field(config, 'spaces', 'parent')),
      programUnitId: linkedId(record, field(config, 'spaces', 'program')),
      primaryFunction: text(record, field(config, 'spaces', 'primaryFunction')),
      active: bool(record, field(config, 'spaces', 'active'), true),
      assignable: field(config, 'spaces', 'assignable')
        ? bool(record, field(config, 'spaces', 'assignable'))
        : defaultAssignable,
      assignmentMode,
      assignmentCapacity: Math.max(1, number(record, field(config, 'spaces', 'assignmentCapacity'), 1)),
      accessSensitivity: text(record, field(config, 'spaces', 'accessSensitivity')),
      reservable: bool(record, field(config, 'spaces', 'reservable')),
      reservationInstructions: text(record, field(config, 'spaces', 'reservationInstructions')),
      notes: text(record, field(config, 'spaces', 'notes')),
    };
  });
}

export function mapPeople(records: RecordLike[], config: SchemaConfig): Person[] {
  return records.map(record => ({
    id: record.id,
    name: text(record, field(config, 'people', 'name')) || record.name || 'Unnamed Person',
    personId: text(record, field(config, 'people', 'personId')),
    email: text(record, field(config, 'people', 'email')),
    personType: text(record, field(config, 'people', 'personType')),
    status: text(record, field(config, 'people', 'status')),
    programUnitId: linkedId(record, field(config, 'people', 'program')),
    expectedEndDate: text(record, field(config, 'people', 'expectedEndDate')),
  }));
}

export function mapAssignments(records: RecordLike[], config: SchemaConfig, rules: AssignmentRules): Assignment[] {
  return records.map(record => {
    const relationshipType = text(record, field(config, 'assignments', 'relationshipType')) || 'Occupant';
    const explicitCapacity = field(config, 'assignments', 'consumesCapacity');
    return {
      id: record.id,
      personId: linkedId(record, field(config, 'assignments', 'person')),
      spaceId: linkedId(record, field(config, 'assignments', 'space')),
      relationshipType,
      startDate: text(record, field(config, 'assignments', 'startDate')),
      expectedEndDate: text(record, field(config, 'assignments', 'expectedEndDate')),
      actualEndDate: text(record, field(config, 'assignments', 'actualEndDate')),
      academicTermId: linkedId(record, field(config, 'assignments', 'term')),
      status: text(record, field(config, 'assignments', 'status')),
      consumesCapacity: explicitCapacity
        ? bool(record, explicitCapacity)
        : rules.capacityRelationships.some(value => value.toLowerCase() === relationshipType.toLowerCase()),
      keyRequired: bool(record, field(config, 'assignments', 'keyRequired')),
      cardAccessRequired: bool(record, field(config, 'assignments', 'cardAccessRequired')),
      accessCompleted: bool(record, field(config, 'assignments', 'accessCompleted')),
      moveFromId: linkedId(record, field(config, 'assignments', 'moveFrom')),
      moveToId: linkedId(record, field(config, 'assignments', 'moveTo')),
      moveStatus: text(record, field(config, 'assignments', 'moveStatus')),
      notes: text(record, field(config, 'assignments', 'notes')),
    };
  });
}

export function mapTerms(records: RecordLike[], config: SchemaConfig): AcademicTerm[] {
  return records.map(record => ({
    id: record.id,
    name: text(record, field(config, 'terms', 'name')) || record.name || 'Unnamed Term',
    code: text(record, field(config, 'terms', 'code')),
    startDate: text(record, field(config, 'terms', 'startDate')) || '',
    endDate: text(record, field(config, 'terms', 'endDate')) || '',
    active: bool(record, field(config, 'terms', 'active')),
  }));
}

export function mapPrograms(records: RecordLike[], config: SchemaConfig): ProgramUnit[] {
  return records.map(record => ({id: record.id, name: text(record, field(config, 'programs', 'name')) || record.name || 'Unnamed organizational area'}));
}

export function mapFloorPlans(records: RecordLike[], config: SchemaConfig): FloorPlan[] {
  return records.map(record => ({
    id: record.id,
    name: text(record, field(config, 'floorPlans', 'name')) || record.name || 'Unnamed Floor Plan',
    building: text(record, field(config, 'floorPlans', 'building')),
    level: text(record, field(config, 'floorPlans', 'level')),
    zoneId: linkedId(record, field(config, 'floorPlans', 'zone')),
    active: field(config, 'floorPlans', 'active') ? bool(record, field(config, 'floorPlans', 'active')) : true,
    file: firstAttachment(record, field(config, 'floorPlans', 'file')),
    version: text(record, field(config, 'floorPlans', 'version')),
    originalWidth: number(record, field(config, 'floorPlans', 'originalWidth')) || undefined,
    originalHeight: number(record, field(config, 'floorPlans', 'originalHeight')) || undefined,
  }));
}

export function mapGeometry(records: RecordLike[], config: SchemaConfig): FloorPlanGeometry[] {
  return records.map(record => {
    const typeText = (text(record, field(config, 'geometry', 'type')) || 'rectangle').toLowerCase();
    return {
      id: record.id,
      floorPlanId: linkedId(record, field(config, 'geometry', 'floorPlan')) || '',
      spaceId: linkedId(record, field(config, 'geometry', 'space')),
      type: typeText.includes('polygon') ? 'polygon' : typeText.includes('point') || typeText.includes('pin') ? 'point' : 'rectangle',
      x: number(record, field(config, 'geometry', 'x')),
      y: number(record, field(config, 'geometry', 'y')),
      width: number(record, field(config, 'geometry', 'width'), 0.04),
      height: number(record, field(config, 'geometry', 'height'), 0.04),
      rotation: number(record, field(config, 'geometry', 'rotation')),
      points: parsePolygon(text(record, field(config, 'geometry', 'polygon'))),
      labelX: number(record, field(config, 'geometry', 'labelX')) || undefined,
      labelY: number(record, field(config, 'geometry', 'labelY')) || undefined,
      zIndex: number(record, field(config, 'geometry', 'zIndex')),
      visible: field(config, 'geometry', 'visible') ? bool(record, field(config, 'geometry', 'visible')) : true,
      locked: bool(record, field(config, 'geometry', 'locked')),
    };
  });
}

export function geometryFields(item: FloorPlanGeometry, config: SchemaConfig): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const assign = (key: string, value: unknown) => { const id = field(config, 'geometry', key); if (id) fields[id] = value; };
  assign('floorPlan', [{id: item.floorPlanId}]); assign('space', item.spaceId ? [{id: item.spaceId}] : []); assign('type', {name: item.type});
  assign('x', item.x); assign('y', item.y); assign('width', item.width); assign('height', item.height); assign('rotation', item.rotation);
  assign('polygon', serializePolygon(item.points)); assign('labelX', item.labelX); assign('labelY', item.labelY); assign('zIndex', item.zIndex);
  assign('visible', item.visible); assign('locked', item.locked); assign('lastUpdated', new Date().toISOString());
  return fields;
}
