import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {SetupWizard} from '../src/components/SetupWizard';
import {discoverSchema, SchemaConfig} from '../src/config/schema';

const base = {tables: [
  {id: 'tblSpaces', name: 'Spaces', fields: [
    {id: 'fldSpaceName', name: 'Space Name'},
    {id: 'fldActive', name: 'Active?'},
  ]},
  {id: 'tblPeople', name: 'People', fields: [
    {id: 'fldPersonName', name: 'Full Name'},
    {id: 'fldPersonType', name: 'Person Type', options: {choices: [{name: 'MDes student'}, {name: 'PhD student'}, {name: 'Staff'}]}},
  ]},
  {id: 'tblAssignments', name: 'Space Assignments & Stewardship', fields: [
    {id: 'fldPerson', name: 'Person'},
    {id: 'fldSpace', name: 'Space'},
    {id: 'fldType', name: 'Relationship Type'},
    {id: 'fldStart', name: 'Start Date'},
    {id: 'fldExpected', name: 'Expected End Date'},
    {id: 'fldActual', name: 'Actual End Date'},
  ]},
  {id: 'tblTerms', name: 'Academic Terms', fields: [
    {id: 'fldTermName', name: 'Term Name'},
    {id: 'fldTermStart', name: 'Start Date'},
    {id: 'fldTermEnd', name: 'End Date'},
  ]},
  {id: 'tblPrograms', name: 'Programs & Units', fields: [{id: 'fldProgramName', name: 'Name'}]},
]};

const rules = {
  capacityRelationships: ['Primary Desk Holder'],
  deskRequiredPersonTypes: ['MDes student'],
  endingSoonDays: 45,
};

function render(config: SchemaConfig, sourceBase: any = base) {
  return renderToStaticMarkup(<SetupWizard
    base={sourceBase}
    initial={config}
    initialRules={rules}
    onSave={async () => undefined}
    onCancel={() => undefined}
  />);
}

describe('simplified setup', () => {
  it('shows a one-screen readiness summary and plain-language person-type choices', () => {
    const markup = render(discoverSchema(base));

    expect(markup).toContain('Your Airtable base is connected');
    expect(markup).toContain('Space and assignment data');
    expect(markup).toContain('Who normally needs a workstation?');
    expect(markup).toContain('MDes student');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('Save and open Space Manager');
    expect(markup).toContain('Advanced connections');
    expect(markup).not.toContain('setup-advanced" open');
  });

  it('opens Advanced connections and disables saving when a required connection is broken', () => {
    const config = discoverSchema(base);
    delete config.tables.people;
    const markup = render(config);

    expect(markup).toContain('Setup needs 1 fix');
    expect(markup).toContain('setup-advanced" open');
    expect(markup).toContain('Needs attention');
    expect(markup).toMatch(/<button class="button primary" disabled="">Save and open Space Manager<\/button>/);
  });

  it('keeps existing advanced rule values available without putting them in the normal flow', () => {
    const markup = render(discoverSchema(base));

    expect(markup).toContain('Primary Desk Holder');
    expect(markup).toContain('value="45"');
    expect(markup).toContain('Advanced assignment behavior');
  });

  it('surfaces an incomplete optional floor-plan connection instead of hiding a blocking error', () => {
    const sourceBase = structuredClone(base);
    sourceBase.tables.push({id: 'tblPlans', name: 'Floor Plans', fields: [
      {id: 'fldPlanName', name: 'Floor Plan Name'},
      {id: 'fldPlanLevel', name: 'Level'},
    ]});
    const markup = render(discoverSchema(sourceBase), sourceBase);

    expect(markup).toContain('A connected floor-plan table is missing something required');
    expect(markup).toContain('setup-advanced" open');
    expect(markup).toContain('Needs attention');
  });

  it('treats standalone geometry as connected but inactive rather than a blocking contradiction', () => {
    const sourceBase = structuredClone(base);
    sourceBase.tables.push({id: 'tblGeometry', name: 'Floor Plan Geometry', fields: [
      {id: 'fldGeometryPlan', name: 'Floor Plan'},
      {id: 'fldGeometrySpace', name: 'Space'},
      {id: 'fldGeometryType', name: 'Geometry Type'},
      {id: 'fldGeometryX', name: 'X'},
      {id: 'fldGeometryY', name: 'Y'},
      {id: 'fldGeometryWidth', name: 'Width'},
      {id: 'fldGeometryHeight', name: 'Height'},
    ]});
    const markup = render(discoverSchema(sourceBase), sourceBase);

    expect(markup).toContain('Your Airtable base is connected');
    expect(markup).toContain('Clickable map data is connected but unused until floor-plan files are connected');
    expect(markup).not.toMatch(/<button class="button primary" disabled="">Save and open Space Manager<\/button>/);
  });
});
