export const CONFIG_KEY = 'sodsSpaceManager.schema.v1';
export const RULES_KEY = 'sodsSpaceManager.rules.v1';

export type TableRole = 'spaces' | 'people' | 'assignments' | 'terms' | 'programs' | 'floorPlans' | 'geometry';

export interface TableMapping {
  tableId: string;
  fields: Record<string, string>;
}

export interface SchemaConfig {
  version: 1;
  tables: Partial<Record<TableRole, TableMapping>>;
}

export interface AssignmentRules {
  capacityRelationships: string[];
  deskRequiredPersonTypes: string[];
  endingSoonDays: number;
}

export const DEFAULT_RULES: AssignmentRules = {
  capacityRelationships: ['Occupant', 'Desk Assignment', 'Office Assignment', 'Primary Workspace', 'Primary Desk Holder'],
  deskRequiredPersonTypes: [],
  endingSoonDays: 30,
};

const LEGACY_DEFAULT_CAPACITY_RELATIONSHIPS = ['Occupant', 'Desk Assignment', 'Office Assignment', 'Primary Workspace'];

export function resolveAssignmentRules(saved?: AssignmentRules): AssignmentRules {
  if (!saved) return DEFAULT_RULES;
  const usesLegacyDefaults = saved.capacityRelationships.length === LEGACY_DEFAULT_CAPACITY_RELATIONSHIPS.length
    && saved.capacityRelationships.every((value, index) => value === LEGACY_DEFAULT_CAPACITY_RELATIONSHIPS[index]);
  return usesLegacyDefaults ? {...saved, capacityRelationships: DEFAULT_RULES.capacityRelationships} : saved;
}

export const TABLE_DEFAULTS: Record<TableRole, string[]> = {
  spaces: ['Spaces'],
  people: ['People'],
  assignments: ['Space Assignments & Stewardship', 'Space Assignments'],
  terms: ['Academic Terms'],
  programs: ['Organizational Areas', 'Programs & Units', 'Programs and Units'],
  floorPlans: ['Floor Plans'],
  geometry: ['Floor Plan Geometry'],
};

export const FIELD_DEFAULTS: Record<TableRole, Record<string, string[]>> = {
  spaces: {
    name: ['Space Name', 'Name'], spaceId: ['Space ID'], type: ['Space Type'], building: ['Building Code', 'Building'],
    level: ['Level', 'Floor'], roomNumber: ['Room / Area Number', 'Room Number'], shortLabel: ['Short Label'],
    parent: ['Parent Space (Zone / Room hierarchy)', 'Parent Space'],
    program: ['Zone Owner', 'Managing Program / Unit', 'Program / Unit'], primaryFunction: ['Primary Function'],
    active: ['Active?'], assignable: ['Assignable?'], assignmentMode: ['Assignment Mode'], assignmentCapacity: ['Assignment Capacity'],
    accessSensitivity: ['Access Sensitivity'], reservable: ['Reservable?'], reservationInstructions: ['Reservation URL / Instructions'], notes: ['Staff Notes'],
  },
  people: {
    name: ['Full Name', 'Name'], personId: ['Person ID'], email: ['Email'],
    personType: ['Person Type'], status: ['Status'], program: ['Primary Affiliation', 'Primary Program / Unit', 'Unit / Program'], expectedEndDate: ['Expected End / Graduation Date'],
  },
  assignments: {
    person: ['Person'], space: ['Space'], relationshipType: ['Relationship Type', 'Space Relationship'], startDate: ['Start Date'],
    expectedEndDate: ['Expected End Date'], actualEndDate: ['Actual End Date'], term: ['Academic Term'], status: ['Relationship Status', 'Status'],
    consumesCapacity: ['Consumes Capacity?'], keyRequired: ['Key Required?'], cardAccessRequired: ['Card Access Required?'],
    accessCompleted: ['Access Completed?'], moveFrom: ['Move From'], moveTo: ['Move To'], moveStatus: ['Move Status'], notes: ['Notes'], current: ['Current?'], endReason: ['End Reason'],
  },
  terms: {name: ['Term Name', 'Name'], code: ['Term Code'], startDate: ['Start Date'], endDate: ['End Date'], active: ['Active?']},
  programs: {name: ['Organizational Area Name', 'Program / Unit Name', 'Name', 'Program Name']},
  floorPlans: {
    name: ['Floor Plan Name', 'Name'], building: ['Building'], level: ['Level'], file: ['Plan File', 'Floor Plan'], version: ['Version'],
    active: ['Active?'], originalWidth: ['Original Width'], originalHeight: ['Original Height'], zone: ['Zone', 'Workspace Area'],
  },
  geometry: {
    floorPlan: ['Floor Plan'], space: ['Space'], type: ['Geometry Type'], x: ['X'], y: ['Y'], width: ['Width'], height: ['Height'],
    rotation: ['Rotation'], polygon: ['Polygon / Path JSON'], labelX: ['Label X'], labelY: ['Label Y'], zIndex: ['Z Index'],
    visible: ['Visible?'], locked: ['Locked?'], lastUpdated: ['Last Updated'], notes: ['Notes'],
  },
};

export const REQUIRED_TABLES: TableRole[] = ['spaces', 'people', 'assignments', 'terms', 'programs'];
export const REQUIRED_FIELDS: Record<TableRole, string[]> = {
  spaces: ['name', 'active'],
  people: ['name'],
  assignments: ['person', 'space', 'relationshipType', 'startDate', 'expectedEndDate', 'actualEndDate'],
  terms: ['name', 'startDate', 'endDate'],
  programs: ['name'],
  floorPlans: ['name', 'level', 'file'],
  geometry: ['floorPlan', 'space', 'type', 'x', 'y', 'width', 'height'],
};

type BaseLike = {tables: Array<{id: string; name: string; fields: Array<{id: string; name: string}>}>};

export function discoverSchema(base: BaseLike): SchemaConfig {
  const config: SchemaConfig = {version: 1, tables: {}};
  (Object.keys(TABLE_DEFAULTS) as TableRole[]).forEach(role => {
    const table = TABLE_DEFAULTS[role].map(name => base.tables.find(candidate => candidate.name.toLowerCase() === name.toLowerCase())).find(Boolean);
    if (!table) return;
    const fields: Record<string, string> = {};
    Object.entries(FIELD_DEFAULTS[role]).forEach(([key, names]) => {
      const field = names.map(name => table.fields.find(candidate => candidate.name.toLowerCase() === name.toLowerCase())).find(Boolean);
      if (field) fields[key] = field.id;
    });
    config.tables[role] = {tableId: table.id, fields};
  });
  return config;
}

export function mergeDiscoveredSchema(saved: SchemaConfig | undefined, discovered: SchemaConfig): SchemaConfig {
  if (!saved || saved.version !== 1) return discovered;
  const tables = {...discovered.tables, ...saved.tables};
  for (const role of Object.keys(tables) as TableRole[]) {
    const previous = saved.tables[role];
    const found = discovered.tables[role];
    if (previous && found?.tableId === previous.tableId) {
      tables[role] = {...previous, fields: {...found.fields, ...previous.fields}};
    }
  }
  return {version: 1, tables};
}

export function validateSchema(base: BaseLike, config: SchemaConfig) {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const role of REQUIRED_TABLES) {
    if (!config.tables[role]) errors.push(`Map the ${TABLE_DEFAULTS[role][0]} table.`);
  }
  (Object.entries(config.tables) as Array<[TableRole, TableMapping]>).forEach(([role, mapping]) => {
    const table = base.tables.find(candidate => candidate.id === mapping.tableId);
    if (!table) {
      errors.push(`Configured ${role} table no longer exists.`);
      return;
    }
    for (const key of REQUIRED_FIELDS[role]) {
      const fieldId = mapping.fields[key];
      if (!fieldId) errors.push(`Map ${table.name}: ${FIELD_DEFAULTS[role][key]?.[0] || key}.`);
      else if (!table.fields.some(field => field.id === fieldId)) errors.push(`Configured field ${key} in ${table.name} no longer exists.`);
    }
  });
  if (!config.tables.floorPlans || !config.tables.geometry) warnings.push('Floor-plan tables are not configured; map and search remain available in list mode.');
  return {valid: errors.length === 0, errors, warnings};
}
