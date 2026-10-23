import React, {useMemo, useState} from 'react';
import {Assignment, Space, ValidationIssue} from '../types/domain';
import {planMove} from '../services/assignmentEngine';

export function MoveDialog({assignment, spaces, initialDate, validate, onSave, onClose}: {
  assignment: Assignment;
  spaces: Space[];
  initialDate: string;
  validate(spaceId: string, date: string): ValidationIssue[];
  onSave(spaceId: string, date: string): Promise<void>;
  onClose(): void;
}) {
  const [spaceId, setSpaceId] = useState('');
  const [date, setDate] = useState(initialDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const issues = useMemo(() => spaceId ? validate(spaceId, date) : [], [spaceId, date, validate]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!spaceId || issues.some(item => item.severity === 'error')) return;
    setSaving(true);
    try { planMove(assignment, spaceId, date); await onSave(spaceId, date); onClose(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop"><form className="modal compact" role="dialog" aria-modal="true" onSubmit={submit}>
    <div className="modal-header"><div><p className="eyebrow">Preserve assignment history</p><h2>Move person</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close">×</button></div>
    <p>The existing assignment will end the day before the move. A new linked assignment will be created at the destination.</p>
    <div className="form-grid"><label>New workstation<select required value={spaceId} onChange={event => setSpaceId(event.target.value)}><option value="">Choose a workstation…</option>{spaces.filter(item => item.assignable && item.id !== assignment.spaceId).sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true})).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Effective move date<input required type="date" value={date} onChange={event => setDate(event.target.value)} /></label></div>
    <div className="issue-list">{issues.map(issue => <p className={`${issue.severity}-text`} key={issue.code}>{issue.message}</p>)}{error && <p className="error-text">{error}</p>}</div>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || !spaceId || issues.some(item => item.severity === 'error')}>{saving ? 'Moving…' : 'Confirm move'}</button></div>
  </form></div>;
}
