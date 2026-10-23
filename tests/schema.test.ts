import {describe, expect, it} from 'vitest';
import {discoverSchema, FIELD_DEFAULTS, mergeDiscoveredSchema, REQUIRED_FIELDS, resolveAssignmentRules, TABLE_DEFAULTS, validateSchema} from '../src/config/schema';

const base = {tables: [
  {id: 'tblSpaces', name: 'Spaces', fields: [{id: 'fldSpaceName', name: 'Space Name'}, {id: 'fldActive', name: 'Active?'}]},
  {id: 'tblPeople', name: 'People', fields: [{id: 'fldPersonName', name: 'Full Name'}]},
  {id: 'tblAssignments', name: 'Space Assignments & Stewardship', fields: [
    {id: 'fldPerson', name: 'Person'}, {id: 'fldSpace', name: 'Space'}, {id: 'fldType', name: 'Relationship Type'}, {id: 'fldStart', name: 'Start Date'}, {id: 'fldExpected', name: 'Expected End Date'}, {id: 'fldActual', name: 'Actual End Date'},
  ]},
  {id: 'tblTerms', name: 'Academic Terms', fields: [{id: 'fldTermName', name: 'Term Name'}, {id: 'fldTermStart', name: 'Start Date'}, {id: 'fldTermEnd', name: 'End Date'}]},
  {id: 'tblPrograms', name: 'Programs & Units', fields: [{id: 'fldProgramName', name: 'Name'}]},
]};

describe('schema configuration', () => {
  it('prefers the canonical relationship and affiliation fields over earlier legacy columns', () => {
    const schema = discoverSchema({tables: [
      {id: 'assignments', name: 'Space Assignments', fields: [
        {id: 'description', name: 'Space Relationship'}, {id: 'type', name: 'Relationship Type'},
      ]},
      {id: 'people', name: 'People', fields: [
        {id: 'legacy-text', name: 'Unit / Program'}, {id: 'program-link', name: 'Primary Program / Unit'},
      ]},
    ]});
    expect(schema.tables.assignments?.fields.relationshipType).toBe('type');
    expect(schema.tables.people?.fields.program).toBe('program-link');
  });
  it('discovers School defaults by name', () => {
    const schema = discoverSchema(base);
    expect(schema.tables.spaces?.tableId).toBe('tblSpaces');
    expect(schema.tables.assignments?.fields.actualEndDate).toBe('fldActual');
  });
  it('keeps stable IDs after fields are renamed', () => {
    const discovered = discoverSchema(base);
    const saved = structuredClone(discovered);
    const renamed = structuredClone(base);
    renamed.tables[0].fields[0].name = 'Renamed Space Display Name';
    const merged = mergeDiscoveredSchema(saved, discoverSchema(renamed));
    expect(merged.tables.spaces?.fields.name).toBe('fldSpaceName');
  });
  it('discovers a new optional Zone link without overriding saved field choices or mixing tables', () => {
    const found = {version: 1 as const, tables: {floorPlans: {tableId: 'plans', fields: {name: 'name', zone: 'zone'}}}};
    const saved = {version: 1 as const, tables: {floorPlans: {tableId: 'plans', fields: {name: 'custom'}}}};
    expect(mergeDiscoveredSchema(saved, found).tables.floorPlans?.fields).toEqual({name: 'custom', zone: 'zone'});
    expect(mergeDiscoveredSchema({...saved, tables: {floorPlans: {...saved.tables.floorPlans, tableId: 'other'}}}, found).tables.floorPlans?.fields).toEqual({name: 'custom'});
  });
  it('reports a missing required table', () => {
    const schema = discoverSchema(base);
    delete schema.tables.people;
    expect(validateSchema(base, schema).errors.some(error => error.includes('People'))).toBe(true);
  });
  it('allows optional integrations to be absent', () => {
    const result = validateSchema(base, discoverSchema(base));
    expect(result.valid).toBe(true);
    expect(result.warnings.some(item => item.includes('Floor-plan'))).toBe(true);
  });
  it('uses hierarchy and organizational-area labels without exposing unused person fields', () => {
    expect(TABLE_DEFAULTS.programs[0]).toBe('Organizational Areas');
    expect(FIELD_DEFAULTS.spaces.parent[0]).toContain('Zone / Room');
    expect(FIELD_DEFAULTS.spaces.program[0]).toBe('Zone Owner');
    expect(FIELD_DEFAULTS.people.program[0]).toBe('Primary Affiliation');
    expect(FIELD_DEFAULTS.people).not.toHaveProperty('preferredName');
    expect(FIELD_DEFAULTS.people).not.toHaveProperty('role');
    expect(REQUIRED_FIELDS.floorPlans).not.toContain('building');
  });
  it('adds Primary Desk Holder only when migrating the exact legacy default rules', () => {
    const migrated = resolveAssignmentRules({
      capacityRelationships: ['Occupant', 'Desk Assignment', 'Office Assignment', 'Primary Workspace'],
      deskRequiredPersonTypes: ['Student'],
      endingSoonDays: 45,
    });
    expect(migrated.capacityRelationships).toContain('Primary Desk Holder');
    expect(migrated.deskRequiredPersonTypes).toEqual(['Student']);
    expect(migrated.endingSoonDays).toBe(45);
  });
  it('preserves a custom capacity relationship list exactly', () => {
    const custom = {capacityRelationships: [], deskRequiredPersonTypes: ['Student'], endingSoonDays: 30};
    expect(resolveAssignmentRules(custom)).toBe(custom);
  });
});
