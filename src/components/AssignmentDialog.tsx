import React, {useMemo, useState} from 'react';
import {AcademicTerm, Assignment, AssignmentDraft, Person, Space, ValidationIssue} from '../types/domain';

interface AssignmentDialogProps {
  people: Person[];
  spaces: Space[];
  terms: AcademicTerm[];
  initial: AssignmentDraft;
  existing?: Assignment;
  title?: string;
  validate(draft: AssignmentDraft): ValidationIssue[];
  onSave(draft: AssignmentDraft): Promise<void>;
  onClose(): void;
}

export function AssignmentDialog({people, spaces, terms, initial, title = 'Assign workstation', validate, onSave, onClose}: AssignmentDialogProps) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const issues = useMemo(() => validate(draft), [draft, validate]);
  const blocking = issues.some(item => item.severity === 'error');
  const set = (key: keyof AssignmentDraft, value: unknown) => setDraft(current => ({...current, [key]: value}));
  function applyTerm(termId: string) {
    const term = terms.find(item => item.id === termId);
    setDraft(current => ({...current, academicTermId: termId || undefined, ...(term ? {startDate: term.startDate, expectedEndDate: term.endDate} : {})}));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSubmitted(true); setError('');
    if (blocking) return;
    setSaving(true);
    try { await onSave(draft); onClose(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <form className="modal" role="dialog" aria-modal="true" aria-labelledby="assignment-title" onSubmit={submit}>
      <div className="modal-header"><div><p className="eyebrow">Workstation assignment</p><h2 id="assignment-title">{title}</h2></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose}>×</button></div>
      <div className="form-grid">
        <label>Person<select required value={draft.personId || ''} onChange={event => set('personId', event.target.value)}><option value="">Choose a person…</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}{person.email ? ` — ${person.email}` : ''}</option>)}</select></label>
        <label>Workstation<select required value={draft.spaceId || ''} onChange={event => set('spaceId', event.target.value)}><option value="">Choose a workstation…</option>{spaces.filter(space => space.assignable).sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true})).map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
        <label>Assignment type<input required value={draft.relationshipType} onChange={event => set('relationshipType', event.target.value)} /></label>
        <label>Academic term<select value={draft.academicTermId || ''} onChange={event => applyTerm(event.target.value)}><option value="">No term / arbitrary dates</option>{terms.map(term => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label>
        <label>Start date<input required type="date" value={draft.startDate || ''} onChange={event => set('startDate', event.target.value)} /></label>
        <label>Expected end date<input type="date" value={draft.expectedEndDate || ''} onChange={event => set('expectedEndDate', event.target.value || undefined)} /><span className="field-hint">Leave blank for indefinite.</span></label>
        <label className="check-label"><input type="checkbox" checked={draft.consumesCapacity} onChange={event => set('consumesCapacity', event.target.checked)} />Counts toward workstation capacity</label>
        <label className="check-label"><input type="checkbox" checked={draft.keyRequired || false} onChange={event => set('keyRequired', event.target.checked)} />Physical key required</label>
        <label className="check-label"><input type="checkbox" checked={draft.cardAccessRequired || false} onChange={event => set('cardAccessRequired', event.target.checked)} />Card access required</label>
        <label className="full-width">Notes<textarea value={draft.notes || ''} onChange={event => set('notes', event.target.value)} rows={3} /></label>
      </div>
      {(submitted || issues.length > 0 || error) && <div className="issue-list" aria-live="polite">{issues.map(issue => <p className={`${issue.severity}-text`} key={issue.code}>{issue.message}</p>)}{error && <p className="error-text">{error}</p>}</div>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || blocking}>{saving ? 'Saving…' : 'Save assignment'}</button></div>
    </form>
  </div>;
}
