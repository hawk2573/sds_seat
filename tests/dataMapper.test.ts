import {describe, expect, it} from 'vitest';
import {DEFAULT_RULES, SchemaConfig} from '../src/config/schema';
import {mapAssignments, mapFloorPlans, mapPeople, mapSpaces} from '../src/services/airtable/dataMapper';

function record(id: string, values: Record<string, unknown>) {
  return {
    id,
    name: String(values.name || id),
    getCellValue(fieldId: string) { return values[fieldId]; },
    getCellValueAsString(fieldId: string) { return values[fieldId] == null ? '' : String(values[fieldId]); },
  };
}

describe('Airtable data mapping', () => {
  it('maps the optional Zone record link while retaining legacy full-floor plans', () => {
    const config: SchemaConfig = {version: 1, tables: {floorPlans: {tableId: 'plans', fields: {zone: 'zone'}}}};
    expect(mapFloorPlans([record('mdes', {zone: [{id: 'mdes-zone'}]}), record('whole', {})], config).map(plan => plan.zoneId)).toEqual(['mdes-zone', undefined]);
  });
  it('uses the image export even when the source PDF is first in the attachment cell', () => {
    const config: SchemaConfig = {version: 1, tables: {floorPlans: {tableId: 'plans', fields: {name: 'name', file: 'file'}}}};
    const pdf = {url: 'source-pdf', filename: 'Plan.pdf', type: 'application/pdf'};
    const png = {url: 'fresh-image-url', filename: 'Plan.png', type: 'image/png', width: 3840, height: 2880};
    const [plan] = mapFloorPlans([record('plan', {name: 'Numbered Plan', file: [pdf, png]})], config);
    expect(plan.file).toEqual(png);
    expect(mapFloorPlans([record('plan', {file: [pdf]})], config)[0].file).toMatchObject(pdf);
    expect(mapFloorPlans([record('plan', {file: []})], config)[0].file).toBeUndefined();
  });
  it('defaults only desk/workstation types to assignable when no Assignable field is mapped', () => {
    const config: SchemaConfig = {version: 1, tables: {spaces: {tableId: 'spaces', fields: {name: 'name', type: 'type', active: 'active'}}}};
    const result = mapSpaces([
      record('zone', {name: 'MDes Zone', type: 'Zone', active: true}),
      record('room', {name: 'Studio 101', type: 'Room', active: true}),
      record('desk', {name: 'Student Desk 1', type: 'Desk / Workstation', active: true}),
    ], config);
    expect(result.map(space => [space.id, space.assignable, space.assignmentMode])).toEqual([
      ['zone', false, 'non-occupancy'],
      ['room', false, 'non-occupancy'],
      ['desk', true, 'exclusive'],
    ]);
  });

  it('does not expose Preferred Name or Role / Title even in an older saved mapping', () => {
    const config: SchemaConfig = {version: 1, tables: {people: {tableId: 'people', fields: {
      name: 'name', preferredName: 'preferred', role: 'role', email: 'email',
    }}}};
    const [person] = mapPeople([record('person', {name: 'Casey Crail', preferred: 'Casey', role: 'Director', email: 'casey@example.edu'})], config);
    expect(person).toEqual({id: 'person', name: 'Casey Crail', personId: undefined, email: 'casey@example.edu', personType: undefined, status: undefined, programUnitId: undefined, expectedEndDate: undefined});
    expect(person).not.toHaveProperty('preferredName');
    expect(person).not.toHaveProperty('role');
  });

  it('recognizes the live Primary Desk Holder relationship without extra setup', () => {
    const config: SchemaConfig = {version: 1, tables: {assignments: {tableId: 'assignments', fields: {
      relationshipType: 'type', person: 'person', space: 'space',
    }}}};
    const [assignment] = mapAssignments([record('assignment', {type: 'Primary Desk Holder'})], config, DEFAULT_RULES);
    expect(assignment.consumesCapacity).toBe(true);
  });
});
