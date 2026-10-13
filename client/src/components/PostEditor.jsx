import { useState } from 'react'
import { toList } from '../api.js'

export default function PostEditor({ post, onSave, onClose }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await onSave({ title: form.get('title'), description: form.get('description'), type: form.get('type'), requiredSkills: toList(form.get('requiredSkills')) })
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal-card" aria-labelledby="post-editor-title" aria-modal="true" role="dialog">
      <div className="modal-heading"><div><p className="eyebrow">OPPORTUNITY</p><h2 id="post-editor-title">{post ? 'Edit post' : 'Create a post'}</h2></div><button className="close-modal" onClick={onClose} type="button" aria-label="Close">×</button></div>
      <form className="form-stack" onSubmit={submit}>
        <label>Post type<select defaultValue={post?.type ?? 'PROJECT_TEAM'} name="type"><option value="HELP_REQUEST">Help request</option><option value="PROJECT_TEAM">Project team</option><option value="HACKATHON_TEAM">Hackathon team</option></select></label>
        <label>Title<input defaultValue={post?.title ?? ''} maxLength="120" minLength="5" name="title" required /></label>
        <label>Description<textarea defaultValue={post?.description ?? ''} maxLength="2000" minLength="20" name="description" rows="5" required /></label>
        <label>Required skills <span className="label-hint">comma separated</span><input defaultValue={post?.requiredSkills.join(', ') ?? ''} name="requiredSkills" placeholder="React, UI Design, APIs" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button className="secondary-button" onClick={onClose} type="button">Cancel</button><button className="primary-button" disabled={busy} type="submit">{busy ? 'Saving…' : post ? 'Save changes' : 'Publish post'}</button></div>
      </form>
    </section>
  </div>
}
