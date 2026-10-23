export type Id = string;

export type AssignmentMode = 'exclusive' | 'shared' | 'non-occupancy';
export type GeometryType = 'point' | 'rectangle' | 'polygon';

export interface ProgramUnit {
  id: Id;
  name: string;
}

export interface Person {
  id: Id;
  name: string;
  personId?: string;
  email?: string;
  personType?: string;
  status?: string;
  programUnitId?: Id;
  expectedEndDate?: string;
}

export interface Space {
  id: Id;
  name: string;
  spaceId?: string;
  shortLabel?: string;
  type?: string;
  building?: string;
  level?: string;
  roomNumber?: string;
  parentSpaceId?: Id;
  programUnitId?: Id;
  primaryFunction?: string;
  active: boolean;
  assignable: boolean;
  assignmentMode: AssignmentMode;
  assignmentCapacity: number;
  accessSensitivity?: string;
  reservable?: boolean;
  reservationInstructions?: string;
  notes?: string;
}

export interface Assignment {
  id: Id;
  personId?: Id;
  spaceId?: Id;
  relationshipType: string;
  startDate?: string;
  expectedEndDate?: string;
  actualEndDate?: string;
  academicTermId?: Id;
  status?: string;
  consumesCapacity: boolean;
  keyRequired?: boolean;
  cardAccessRequired?: boolean;
  accessCompleted?: boolean;
  moveFromId?: Id;
  moveToId?: Id;
  moveStatus?: string;
  notes?: string;
}

export interface AcademicTerm {
  id: Id;
  name: string;
  code?: string;
  startDate: string;
  endDate: string;
  active?: boolean;
}

export interface FloorPlan {
  id: Id;
  name: string;
  building?: string;
  level?: string;
  zoneId?: Id;
  active: boolean;
  file?: {url: string; filename: string; type?: string; width?: number; height?: number};
  originalWidth?: number;
  originalHeight?: number;
  version?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface FloorPlanGeometry {
  id: Id;
  floorPlanId: Id;
  spaceId?: Id;
  type: GeometryType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  points?: Point[];
  labelX?: number;
  labelY?: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  dirty?: boolean;
  isNew?: boolean;
}

export interface DateRange {
  start: string;
  end?: string;
}

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  code: string;
  severity: Severity;
  message: string;
  relatedRecordIds?: Id[];
}

export interface AvailabilityResult {
  available: boolean;
  needsReview?: boolean;
  capacity: number;
  occupied: number;
  remaining: number;
  conflicts: Assignment[];
  reason?: string;
}

export interface AssignmentDraft {
  id?: Id;
  personId?: Id;
  spaceId?: Id;
  relationshipType: string;
  startDate?: string;
  expectedEndDate?: string;
  actualEndDate?: string;
  academicTermId?: Id;
  status?: string;
  consumesCapacity: boolean;
  keyRequired?: boolean;
  cardAccessRequired?: boolean;
  notes?: string;
}

export interface MovePlan {
  existingAssignmentId: Id;
  personId: Id;
  fromSpaceId: Id;
  toSpaceId: Id;
  moveDate: string;
  closeOldOn: string;
  newAssignment: AssignmentDraft;
}
