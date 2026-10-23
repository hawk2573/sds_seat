import React, {useMemo, useState} from 'react';
import {
  AssignmentRules,
  discoverSchema,
  FIELD_DEFAULTS,
  REQUIRED_FIELDS,
  REQUIRED_TABLES,
  SchemaConfig,
  TableRole,
  validateSchema,
} from '../config/schema';

interface SetupWizardProps {
  base: any;
  initial: SchemaConfig;
  initialRules: AssignmentRules;
  onSave(config: SchemaConfig, rules: AssignmentRules): Promise<void>;
  onCancel?: () => void;
}

const roles: TableRole[] = ['spaces', 'people', 'assignments', 'terms', 'programs', 'floorPlans', 'geometry'];
const coreRoles: TableRole[] = ['spaces', 'people', 'assignments', 'terms', 'programs'];

const ROLE_COPY: Record<TableRole, {label: string; description: string}> = {
  spaces: {label: 'Workstations and spaces', description: 'Desks, rooms, floors, and workspace areas'},
  people: {label: 'People', description: 'People who can receive a workstation'},
  assignments: {label: 'Assignments', description: 'Who uses which workstation and when'},
  terms: {label: 'Academic dates', description: 'Terms and their start and end dates'},
  programs: {label: 'Workspace-area owners', description: 'MDes, PhD, SoDS Operations, and similar groups'},
  floorPlans: {label: 'Floor-plan files', description: 'Optional background plans for the visual map'},
  geometry: {label: 'Clickable map areas', description: 'Optional workstation shapes drawn over a floor plan'},
};

function connectionReady(base: any, config: SchemaConfig, role: TableRole): boolean {
  const mapping = config.tables[role];
  if (!mapping) return false;
  const table = base.tables.find((item: any) => item.id === mapping.tableId);
  if (!table) return false;
  return REQUIRED_FIELDS[role].every(key => {
    const fieldId = mapping.fields[key];
    return Boolean(fieldId && table.fields.some((field: any) => field.id === fieldId));
  });
}

export function SetupWizard({base, initial, initialRules, onSave, onCancel}: SetupWizardProps) {
  const [config, setConfig] = useState(initial);
  const [rules, setRules] = useState(initialRules);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const validation = useMemo(() => validateSchema(base, config), [base, config]);
  const connectionStates = useMemo(() => new Map(roles.map(role => [role, connectionReady(base, config, role)])), [base, config]);
  const peopleMapping = config.tables.people;
  const peopleTable = peopleMapping ? base.tables.find((item: any) => item.id === peopleMapping.tableId) : undefined;
  const personTypeField = peopleTable?.fields.find((item: any) => item.id === peopleMapping?.fields.personType);
  const personTypeChoices = ((personTypeField?.options?.choices || []) as Array<{name?: string}>)
    .map(choice => choice.name?.trim())
    .filter((name): name is string => Boolean(name));

  function selectTable(role: TableRole, tableId: string) {
    const table = base.tables.find((item: any) => item.id === tableId);
    const fields: Record<string, string> = {};
    if (table) Object.entries(FIELD_DEFAULTS[role]).forEach(([key, names]) => {
      const found = table.fields.find((candidate: any) => (names as string[]).some(name => name.toLowerCase() === candidate.name.toLowerCase()));
      if (found) fields[key] = found.id;
    });
    setConfig(current => ({...current, tables: {...current.tables, [role]: tableId ? {tableId, fields} : undefined}}));
  }

  function selectField(role: TableRole, key: string, fieldId: string) {
    const mapping = config.tables[role];
    if (!mapping) return;
    setConfig(current => ({...current, tables: {...current.tables, [role]: {...mapping, fields: {...mapping.fields, [key]: fieldId}}}}));
  }

  function togglePersonType(name: string) {
    setRules(current => ({
      ...current,
      deskRequiredPersonTypes: current.deskRequiredPersonTypes.includes(name)
        ? current.deskRequiredPersonTypes.filter(value => value !== name)
        : [...current.deskRequiredPersonTypes, name],
    }));
  }

  function restoreAutomaticConnections() {
    setConfig(discoverSchema(base));
    setMessage('Automatic connections restored. Review the status below, then save.');
  }

  async function save() {
    setSaving(true); setMessage('');
    try { await onSave(config, rules); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setSaving(false); }
  }

  const mappedCoreCount = coreRoles.filter(role => connectionStates.get(role)).length;
  const coreReady = mappedCoreCount === coreRoles.length;
  const floorPlansConfigured = Boolean(config.tables.floorPlans);
  const geometryConfigured = Boolean(config.tables.geometry);
  const mapNeedsAttention = (floorPlansConfigured && !connectionStates.get('floorPlans'))
    || (geometryConfigured && !connectionStates.get('geometry'));
  const geometryWaitingForPlan = geometryConfigured && connectionStates.get('geometry') && !floorPlansConfigured;
  const mapConnected = Boolean(connectionStates.get('floorPlans'));
  const mapStatus = mapNeedsAttention
    ? 'A connected floor-plan table is missing something required'
    : geometryWaitingForPlan
      ? 'Clickable map data is connected but unused until floor-plan files are connected'
    : mapConnected
      ? connectionStates.get('geometry') ? 'Visual map connected' : 'Plan files connected; clickable areas are optional'
      : 'Optional; workstation list is available now';

  return <div className="setup-shell">
    <header className="setup-header">
      <p className="eyebrow">School of Design &amp; Society</p>
      <h1>Space Manager setup</h1>
      <p>Most of this is automatic. Confirm who should appear in the assignment queue, then save. Only open Advanced connections if something says it needs attention.</p>
    </header>

    <section className={`setup-readiness ${validation.valid ? 'ready' : 'needs-attention'}`}>
      <span className="setup-readiness-icon" aria-hidden="true">{validation.valid ? '✓' : '!'}</span>
      <div>
        <p className="eyebrow">{validation.valid ? 'Ready' : 'Needs attention'}</p>
        <h2>{validation.valid ? 'Your Airtable base is connected' : `Setup needs ${validation.errors.length} ${validation.errors.length === 1 ? 'fix' : 'fixes'}`}</h2>
        <p>{validation.valid ? `${mappedCoreCount} of ${coreRoles.length} required connections were found automatically.` : 'Open Advanced connections below. The item that needs attention will already be expanded.'}</p>
      </div>
    </section>

    <div className="setup-simple-grid">
      <section className="setup-card setup-people-rule">
        <p className="eyebrow">Assignment queue</p>
        <h2>Who normally needs a workstation?</h2>
        <p>Select the Person Types that should appear under <strong>Needs workspace</strong> when they do not have an active assignment. This does not assign or move anyone.</p>
        {personTypeChoices.length ? <div className="setup-choice-list">
          {personTypeChoices.map(name => <button
            type="button"
            key={name}
            className={rules.deskRequiredPersonTypes.includes(name) ? 'setup-choice selected' : 'setup-choice'}
            aria-pressed={rules.deskRequiredPersonTypes.includes(name)}
            onClick={() => togglePersonType(name)}
          ><span aria-hidden="true">{rules.deskRequiredPersonTypes.includes(name) ? '✓' : ''}</span>{name}</button>)}
        </div> : <p className="setup-neutral-note">Person Type choices are not available from Airtable. The assignment queue can stay off, or its values can be entered under Advanced assignment behavior.</p>}
        {!rules.deskRequiredPersonTypes.length && <p className="setup-neutral-note">No Person Types selected yet. The Workspaces screen will still work normally.</p>}
      </section>

      <section className="setup-card">
        <p className="eyebrow">Connection summary</p>
        <h2>What the extension found</h2>
        <div className="setup-connection-list">
          <div className="setup-connection-row">
            <span className={coreReady ? 'connection-dot ready' : 'connection-dot error'} aria-hidden="true" />
            <span><strong>Space and assignment data</strong><small>{coreReady ? 'Workstations, people, assignments, dates, and workspace areas are connected' : `${mappedCoreCount} of ${coreRoles.length} required connections found`}</small></span>
            <b>{coreReady ? 'Connected' : 'Needs attention'}</b>
          </div>
          <div className={mapNeedsAttention ? 'setup-connection-row optional error' : 'setup-connection-row optional'}>
            <span className={mapNeedsAttention ? 'connection-dot error' : mapConnected ? 'connection-dot ready' : 'connection-dot optional'} aria-hidden="true" />
            <span><strong>Floor-plan map</strong><small>{mapStatus}</small></span>
            <b>{mapNeedsAttention ? 'Needs attention' : mapConnected ? 'Connected' : 'Optional'}</b>
          </div>
        </div>
      </section>
    </div>

    <details className="setup-advanced" open={!validation.valid}>
      <summary><span><strong>Advanced connections</strong><small>Table names, field connections, and assignment behavior</small></span><span aria-hidden="true">⌄</span></summary>
      <div className="setup-advanced-body">
        <div className="advanced-intro">
          <div><h2>Only change these if a connection is wrong</h2><p>Space Manager remembers the connected Airtable fields even if their names change later.</p></div>
          <button type="button" className="button secondary" onClick={restoreAutomaticConnections}>Restore automatic connections</button>
        </div>
        <div className="setup-grid">
          {roles.map(role => {
            const mapping = config.tables[role];
            const table = mapping ? base.tables.find((item: any) => item.id === mapping.tableId) : undefined;
            const required = REQUIRED_TABLES.includes(role);
            const ready = Boolean(connectionStates.get(role));
            const needsAttention = !ready && (required || Boolean(mapping));
            return <details className="setup-section" key={role} open={needsAttention}>
              <summary className="section-title-row"><div><h3>{ROLE_COPY[role].label}</h3><span>{required ? 'Required' : 'Optional'}</span></div><span className={ready ? 'check-ok' : needsAttention ? 'check-error' : 'check-warn'}>{ready ? 'Connected' : needsAttention ? 'Needs attention' : 'Optional'}</span></summary>
              <div className="setup-section-body">
                <p>{ROLE_COPY[role].description}</p>
                <label>Airtable table
                  <select value={mapping?.tableId || ''} onChange={event => selectTable(role, event.target.value)}>
                    <option value="">Choose a table…</option>
                    {base.tables.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                {table && Object.keys(FIELD_DEFAULTS[role]).map(key => {
                  const isRequired = REQUIRED_FIELDS[role].includes(key);
                  return <label key={key}>{FIELD_DEFAULTS[role][key][0]} {isRequired && <span className="required">required</span>}
                    <select value={mapping?.fields[key] || ''} onChange={event => selectField(role, key, event.target.value)}>
                      <option value="">Not connected</option>
                      {table.fields.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>;
                })}
              </div>
            </details>;
          })}
        </div>
        <section className="advanced-rules">
          <h2>Advanced assignment behavior</h2>
          <div className="form-grid">
            <label>Assignment Types that use workstation capacity<textarea rows={3} value={rules.capacityRelationships.join(', ')} onChange={event => setRules(current => ({...current, capacityRelationships: event.target.value.split(',').map(value => value.trim()).filter(Boolean)}))} /><span className="field-hint">Usually leave this alone. A mapped Counts toward capacity checkbox overrides this list.</span></label>
            <label>Ending-soon notice (days)<input type="number" min="1" max="365" value={rules.endingSoonDays} onChange={event => setRules(current => ({...current, endingSoonDays: Math.max(1, Number(event.target.value) || 30)}))} /><span className="field-hint">Controls when an upcoming assignment end date is highlighted.</span></label>
            <label className="full-width">Person Types shown under Needs workspace<textarea rows={2} value={rules.deskRequiredPersonTypes.join(', ')} onChange={event => setRules(current => ({...current, deskRequiredPersonTypes: event.target.value.split(',').map(value => value.trim()).filter(Boolean)}))} /><span className="field-hint">The normal Setup screen provides buttons for the choices Airtable reports. This fallback accepts exact names separated by commas.</span></label>
          </div>
        </section>
        {(validation.errors.length > 0 || validation.warnings.length > 0) && <div className="validation-box" role="alert">
          {validation.errors.map(error => <p key={error} className="error-text">{error}</p>)}
          {validation.warnings.map(warning => <p key={warning} className="warning-text">{warning}</p>)}
        </div>}
      </div>
    </details>

    {message && <div className="setup-message" role="status">{message}</div>}
    <footer className="setup-actions">
      {onCancel && <button className="button secondary" onClick={onCancel}>Back to Space Manager</button>}
      <button className="button primary" disabled={!validation.valid || saving} onClick={save}>{saving ? 'Saving…' : 'Save and open Space Manager'}</button>
    </footer>
  </div>;
}
