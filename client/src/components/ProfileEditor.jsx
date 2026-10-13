import { useState } from 'react'
import { toList } from '../api.js'

export default function ProfileEditor({ student, onSave, onClose }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await onSave({ name: form.get('name'), bio: form.get('bio'), skills: toList(form.get('skills')), interests: toList(form.get('interests')), portfolioUrl: form.get('portfolioUrl') })
    } catch (saveError) { setError(saveError.message) } finally { setBusy(false) }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal-card" aria-modal="true" role="dialog">
    <div className="modal-heading"><div><p className="eyebrow">YOUR PROFILE</p><h2>Edit your profile</h2></div><button className="close-modal" onClick={onClose} type="button" aria-label="Close">×</button></div>
    <form className="form-stack" onSubmit={submit}>
      <label>Name<input defaultValue={student.name} maxLength="80" minLength="2" name="name" required /></label>
      <label>Bio<textarea defaultValue={student.bio} maxLength="500" name="bio" rows="4" /></label>
      <label>Skills <span className="label-hint">comma separated</span><input defaultValue={student.skills.join(', ')} name="skills" placeholder="JavaScript, Research, Writing" /></label>
      <label>Interests <span className="label-hint">comma separated</span><input defaultValue={student.interests.join(', ')} name="interests" placeholder="Climate, Design, Robotics" /></label>
      <label>GitHub or portfolio URL<input defaultValue={student.portfolioUrl ?? ''} name="portfolioUrl" placeholder="https://..." type="url" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="secondary-button" onClick={onClose} type="button">Cancel</button><button className="primary-button" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save profile'}</button></div>
    </form>
  </section></div>
}
