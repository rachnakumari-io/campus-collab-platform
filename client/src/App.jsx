import { useCallback, useEffect, useState } from 'react'
import './App.css'
import AuthScreen from './components/AuthScreen.jsx'
import OpportunityCard from './components/OpportunityCard.jsx'
import PostEditor from './components/PostEditor.jsx'
import ProfileEditor from './components/ProfileEditor.jsx'
import { api } from './api.js'

const views = [
  ['explore', 'Explore'], ['my-posts', 'My posts'], ['students', 'Find students'],
  ['requests', 'Requests'], ['skills', 'Skills catalogue'], ['profile', 'My profile'],
]
const postTypes = [['ALL', 'All opportunities'], ['HELP_REQUEST', 'Help requests'], ['PROJECT_TEAM', 'Project teams'], ['HACKATHON_TEAM', 'Hackathon teams']]

function initials(name = '') { return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() }
function MessageDialog({ post, onClose, onSend }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try { await onSend(message) } 
    catch (sendError) { setError(sendError.message) }
     finally { setBusy(false) }
  }
  return
   <div 
   className="modal-backdrop">
    <section className="modal-card" aria-modal="true" role="dialog">
    <div className="modal-heading">
      <div><p className="eyebrow">INTRODUCE YOURSELF</p><h2>Request to collaborate</h2><p className="auth-subtitle">For: {post.title}</p></div>
      <button className="close-modal" onClick={onClose} type="button" aria-label="Close">×</button>
      </div>
      <form className="form-stack" onSubmit={submit}>
        <label>Your message<textarea autoFocus maxLength="500" minLength="10" onChange={(event) => setMessage(event.target.value)} placeholder="Tell them why you are interested and what you can contribute..." required rows="5" value={message} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">Cancel</button>
          <button className="primary-button" disabled={busy} type="submit">{busy ? 'Sending…' : 'Send request'}</button>
          </div>
          </form>
          </section>
          </div>
}

function App() {
  const [student, setStudent] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [view, setView] = useState('explore')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('ALL')
  const [skill, setSkill] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [postEditor, setPostEditor] = useState(null)
  const [profileEditor, setProfileEditor] = useState(false)
  const [selected, setSelected] = useState(null)
  const [requestPost, setRequestPost] = useState(null)
  const [skillName, setSkillName] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api('/auth/me').then(({ student: current }) => setStudent(current)).catch(() => setStudent(null)).finally(() => setAuthLoading(false))
  }, [])

  useEffect(() => {
    if (!student) return
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setPageError('')
      try {
        let next
        if (view === 'explore') {
          const params = new URLSearchParams({ q: query, type })
          if (skill) params.set('skill', skill)
          const [feed, catalogue] = await Promise.all([api(`/posts?${params}`), api('/skills')])
          next = { ...feed, skills: catalogue.skills }
        } else if (view === 'my-posts') {
          next = await api('/posts/mine')
        } else if (view === 'students') {
          next = await api(`/profiles?search=${encodeURIComponent(query)}`)
        } else if (view === 'profile') {
          next = await api('/profiles/me')
        } else if (view === 'requests') {
          const [sent, received] = await Promise.all([api('/requests/sent'), api('/requests/received')])
          next = { sent: sent.requests, received: received.requests }
        } else if (view === 'skills') {
          const catalogue = await api('/skills')
          next = catalogue
          if (student.role === 'ADMIN') next.pending = (await api('/admin/skills/suggestions')).suggestions
        }
        if (active) setData(next)
      } catch (error) {
        if (active) setPageError(error.message)
      } finally {
        if (active) setLoading(false)
      }
    }, view === 'explore' || view === 'students' ? 180 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [student, view, query, type, skill, refresh])

  const notify = useCallback((message) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3200)
  }, [])
  const reload = useCallback(() => setRefresh((value) => value + 1), [])

  async function handleAuth(form, mode) {
    setAuthBusy(true)
    setAuthError('')
    try {
      const result = await api(`/auth/${mode}`, { method: 'POST', body: form })
      setStudent(result.student)
      setView('explore')
    } catch (error) { setAuthError(error.message) } finally { setAuthBusy(false) }
  }

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' })
      setStudent(null)
      setData(null)
      setView('explore')
    } catch (error) { notify(error.message) }
  }

  async function savePost(form) {
    const editing = postEditor?.id
    const result = await api(editing ? `/posts/${editing}` : '/posts', { method: editing ? 'PATCH' : 'POST', body: form })
    setPostEditor(null)
    setView('my-posts')
    reload()
    notify(editing ? 'Post updated.' : 'Your post is live.')
    return result
  }

  async function togglePost(post) {
    const status = post.status === 'OPEN' ? 'CLOSED' : 'OPEN'
    try {
      await api(`/posts/${post.id}/status`, { method: 'PATCH', body: { status } })
      reload()
      notify(status === 'OPEN' ? 'Post reopened.' : 'Post closed.')
    } catch (error) { notify(error.message) }
  }

  async function saveProfile(form) {
    const result = await api('/profiles/me', { method: 'PATCH', body: form })
    setStudent(result.student)
    setProfileEditor(false)
    reload()
  }

  async function sendRequest(message) {
    await api('/requests', { method: 'POST', body: { postId: requestPost.id, message } })
    setRequestPost(null)
    notify('Collaboration request sent.')
    reload()
  }

  async function updateRequest(request, status) {
    try {
      await api(`/requests/${request.id}/status`, { method: 'PATCH', body: { status } })
      reload()
      notify(`Request ${status.toLowerCase()}.`)
    } catch (error) { notify(error.message) }
  }

  async function suggestSkill(event) {
    event.preventDefault()
    try {
      await api('/skills/suggestions', { method: 'POST', body: { name: skillName } })
      setSkillName('')
      notify('Skill suggestion sent for admin review.')
      reload()
    } catch (error) { notify(error.message) }
  }

  async function reviewSkill(suggestion, status) {
    try { await api(`/admin/skills/suggestions/${suggestion.id}`, { method: 'PATCH', body: { status } }); reload() } catch (error) { notify(error.message) }
  }

  if (authLoading) return <div className="screen-loading">Loading Campus Connect…</div>
  if (!student) return <AuthScreen busy={authBusy} error={authError} onSubmit={handleAuth} />

  const currentViewTitle = views.find(([id]) => id === view)?.[1] ?? 'Explore'
  const feedPosts = view === 'explore' ? (data?.posts ?? []) : view === 'my-posts' ? (data?.posts ?? []) : []

  return <div className="app-shell">
    <aside className="sidebar" aria-label="Main navigation">
      <a className="brand" href="#explore" onClick={(event) => { event.preventDefault(); setView('explore') }}><span className="brand-mark">C</span><span>campus<span className="brand-light">connect</span></span></a>
      <div className="sidebar-section-label">Workspace</div>
      <nav className="main-nav">{views.map(([id, label]) => <button key={id} className={`nav-link ${view === id ? 'nav-link-active' : ''}`} onClick={() => { setView(id); setQuery('') }} type="button"><span className="nav-icon" aria-hidden="true">{({ explore: '⌕', 'my-posts': '▤', students: '◎', requests: '↗', skills: '◇', profile: '○' })[id]}</span>{label}{id === 'requests' && <span className="nav-count">{data?.received?.filter((item) => item.status === 'PENDING').length ?? ''}</span>}</button>)}</nav>
      {view === 'explore' && <><div className="sidebar-section-label discover-label">Discover</div><nav className="main-nav">{postTypes.slice(1).map(([value, label]) => <button key={value} className={`nav-link nav-filter ${type === value ? 'nav-filter-active' : ''}`} onClick={() => setType(type === value ? 'ALL' : value)} type="button"><span className={`type-dot type-dot-${value.toLowerCase()}`} />{label}</button>)}</nav></>}
      <div className="sidebar-bottom"><span className="profile-avatar">{initials(student.name)}</span><div className="profile-copy"><strong>{student.name}</strong><span>{student.college?.name}</span></div><button className="icon-button profile-menu" onClick={logout} title="Log out" type="button">↪</button></div>
    </aside>

    <main className="main-content" id="explore">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{currentViewTitle}</strong></div><div className="topbar-actions"><button className="help-link" onClick={() => setView('skills')} type="button">Skills catalogue</button><button className="help-link logout-link" onClick={logout} type="button">Log out</button><button className="top-avatar" onClick={() => setView('profile')} type="button" aria-label="Open my profile">{initials(student.name)}</button></div></header>
      <div className="page-content">
        {view === 'explore' && <>
          <section className="page-heading"><div><p className="eyebrow">YOUR CAMPUS, YOUR COMMUNITY</p><h1>Find your people.</h1><p className="page-subtitle">Discover projects, share what you know, and build something together.</p></div><button className="create-button" onClick={() => setPostEditor({})} type="button"><span>＋</span> Create a post</button></section>
          <section className="explore-panel" aria-label="Explore opportunities"><div className="explore-toolbar"><div className="section-title"><h2>Explore opportunities</h2><span className="result-count">{feedPosts.length}</span></div><label className="search-box"><span className="search-icon">⌕</span><input aria-label="Search opportunities" onChange={(event) => setQuery(event.target.value)} placeholder="Search projects, skills, or people..." type="search" value={query} /></label></div>
            <div className="filter-row" aria-label="Filter opportunities by type">{postTypes.map(([value, label]) => <button aria-pressed={type === value} className={`filter-button ${type === value ? 'filter-button-active' : ''}`} key={value} onClick={() => setType(value)} type="button">{label}</button>)}<select aria-label="Filter by skill" className="skill-select" onChange={(event) => setSkill(event.target.value)} value={skill}><option value="">All skills</option>{(data?.skills ?? []).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></div>
            <div className="opportunity-list" aria-live="polite">{loading ? <div className="empty-state">Loading opportunities…</div> : feedPosts.map((post) => <OpportunityCard currentUserId={student.id} key={post.id} onCollaborate={setRequestPost} onEdit={setPostEditor} onToggleStatus={togglePost} onView={setSelected} post={post} />)}{!loading && feedPosts.length === 0 && <div className="empty-state"><span className="empty-icon">⌕</span><h3>No opportunities found</h3><p>Try another search, or create the first post for your campus.</p><button onClick={() => { setQuery(''); setType('ALL'); setSkill('') }} type="button">Clear filters</button></div>}</div>
          </section><p className="demo-note">Opportunities are shared by students at their listed college.</p>
        </>}

        {view === 'my-posts' && <><PageHeading eyebrow="YOUR OPPORTUNITIES" title="My posts" description="Manage the opportunities you have shared." action={<button className="create-button" onClick={() => setPostEditor({})} type="button">＋ Create a post</button>} />{pageError && <p className="form-error">{pageError}</p>}<section className="explore-panel"><div className="opportunity-list">{loading ? <div className="empty-state">Loading your posts…</div> : feedPosts.map((post) => <OpportunityCard currentUserId={student.id} key={post.id} onCollaborate={setRequestPost} onEdit={setPostEditor} onToggleStatus={togglePost} onView={setSelected} post={post} />)}{!loading && feedPosts.length === 0 && <Empty title="You haven't posted yet" text="Create an opportunity to find teammates or get help." />}</div></section></>}

        {view === 'profile' && (loading ? <p className="loading-note">Loading your profile…</p> : data?.student && <ProfileView student={data.student} onEdit={() => setProfileEditor(true)} />)}
        {view === 'students' && <><PageHeading eyebrow="CAMPUS COMMUNITY" title="Find students" description="Search students by name, college, skills, or interests." /><label className="search-box directory-search"><span className="search-icon">⌕</span><input aria-label="Search students" onChange={(event) => setQuery(event.target.value)} placeholder="Search students, skills, or colleges..." value={query} /></label>{pageError && <p className="form-error">{pageError}</p>}<div className="student-grid">{loading ? <p>Loading students…</p> : (data?.students ?? []).map((person) => <button className="student-card" key={person.id} onClick={() => setSelected({ profile: person })} type="button"><span className="student-avatar">{initials(person.name)}</span><strong>{person.name}</strong><span>{person.college?.name}</span><p>{person.bio || 'Student exploring new collaborations.'}</p><div className="skill-list">{person.skills.slice(0, 4).map((item) => <span className="skill-chip" key={item}>{item}</span>)}</div></button>)}{!loading && data?.students?.length === 0 && <Empty title="No students found" text="Try a different name, skill, or college." />}</div></>}

        {view === 'requests' && <><PageHeading eyebrow="COLLABORATION" title="Requests" description="Keep track of invitations you have sent and received." />{pageError && <p className="form-error">{pageError}</p>}<section className="explore-panel requests-panel"><h2>Received</h2>{loading ? <p>Loading requests…</p> : (data?.received ?? []).map((request) => <RequestRow key={request.id} request={request} kind="received" onUpdate={updateRequest} onProfile={(profile) => setSelected({ profile })} />)}{!loading && !data?.received?.length && <p className="empty-inline">No one has sent you a request yet.</p>}<h2>Sent</h2>{loading ? <p>Loading requests…</p> : (data?.sent ?? []).map((request) => <RequestRow key={request.id} request={request} kind="sent" onUpdate={updateRequest} />)}{!loading && !data?.sent?.length && <p className="empty-inline">You have not sent any requests yet.</p>}</section></>}

        {view === 'skills' && <><PageHeading eyebrow="SHARED SKILLS" title="Skills catalogue" description="Browse approved skills or suggest one for the community." />{pageError && <p className="form-error">{pageError}</p>}<section className="explore-panel skills-panel"><form className="skill-suggest-form" onSubmit={suggestSkill}><label htmlFor="skill-suggestion">Suggest a skill</label><div><input id="skill-suggestion" maxLength="40" minLength="2" onChange={(event) => setSkillName(event.target.value)} placeholder="e.g. Geographic Information Systems" required value={skillName} /><button className="primary-button" type="submit">Submit suggestion</button></div><p>Suggestions become official after an admin reviews them.</p></form>{loading ? <p className="loading-note">Loading catalogue…</p> : <div className="catalogue-list">{(data?.skills ?? []).map((item) => <span className="skill-chip" key={item.id}>{item.name}</span>)}{!data?.skills?.length && <span className="empty-inline">No skills are listed yet. You can suggest the first one.</span>}</div>}{student.role === 'ADMIN' && <><h2>Pending review</h2>{(data?.pending ?? []).map((item) => <div className="review-row" key={item.id}><span><strong>{item.name}</strong><small>Suggested by {item.student.name} · {item.student.college.name}</small></span><button className="text-button" onClick={() => reviewSkill(item, 'APPROVED')} type="button">Approve</button><button className="text-button danger-text" onClick={() => reviewSkill(item, 'REJECTED')} type="button">Reject</button></div>)}</>}</section></>}

        {pageError && view !== 'my-posts' && view !== 'students' && view !== 'requests' && view !== 'skills' && <p className="form-error">{pageError}</p>}
      </div>
    </main>
    {postEditor && <PostEditor onClose={() => setPostEditor(null)} onSave={savePost} post={postEditor.id ? postEditor : null} />}
    {profileEditor && <ProfileEditor onClose={() => setProfileEditor(false)} onSave={saveProfile} student={student} />}
    {requestPost && <MessageDialog onClose={() => setRequestPost(null)} onSend={sendRequest} post={requestPost} />}
    {selected && <DetailDialog currentUserId={student.id} onClose={() => setSelected(null)} onRequest={setRequestPost} onProfile={(profile) => setSelected({ profile })} selected={selected} />}
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>
}

function PageHeading(
  { eyebrow, title, description, action }) { return <section className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-subtitle">{description}</p></div>{action}</section> }
function Empty(
  { title, text }) { return <div className="empty-state"><span className="empty-icon">⌕</span><h3>{title}</h3><p>{text}</p></div> }
function ProfileView(
  { student, onEdit }) { return <><PageHeading eyebrow="STUDENT PROFILE" title={student.name} description={student.college?.name} action={onEdit && <button className="create-button" onClick={onEdit} type="button">Edit profile</button>} /><section className="profile-panel"><span className="large-avatar">{initials(student.name)}</span><div className="profile-details"><h2>{student.name}</h2><p>{student.email}</p><p>{student.college?.name}</p>{student.bio && <p className="profile-bio">{student.bio}</p>}{student.portfolioUrl && <a href={student.portfolioUrl} target="_blank" rel="noreferrer">Portfolio / GitHub ↗</a>}<h3>Skills</h3><div className="skill-list">{student.skills.map((item) => <span className="skill-chip" key={item}>{item}</span>)}{!student.skills.length && <span className="empty-inline">No skills added yet.</span>}</div><h3>Interests</h3><div className="skill-list">{student.interests.map((item) => <span className="skill-chip" key={item}>{item}</span>)}{!student.interests.length && <span className="empty-inline">No interests added yet.</span>}</div></div></section></> }
function RequestRow(
  { request, kind, onUpdate, onProfile }) { const person = kind === 'received' ? request.requester : request.post.author; return <article className="request-row"><div className="request-person"><button className="author-info author-button" onClick={() => onProfile?.(person)} type="button"><span className="author-avatar">{initials(person.name)}</span><span className="author-copy"><strong>{person.name}</strong><span>{request.post.title}</span></span></button><p>{request.message}</p></div><div className="request-controls"><span className={`request-status status-${request.status.toLowerCase()}`}>{request.status.toLowerCase()}</span>{request.status === 'PENDING' && kind === 'received' && <><button className="primary-button small-button" onClick={() => onUpdate(request, 'ACCEPTED')} type="button">Accept</button><button className="text-button danger-text" onClick={() => onUpdate(request, 'REJECTED')} type="button">Reject</button></>}{request.status === 'PENDING' && kind === 'sent' && <button className="text-button" onClick={() => onUpdate(request, 'WITHDRAWN')} type="button">Withdraw</button>}</div></article> }
function DetailDialog(
  { selected, onClose, onRequest, onProfile, currentUserId }) {
  if (selected.profile) return <div className="modal-backdrop"><section className="modal-card" aria-modal="true" role="dialog"><div className="modal-heading"><div><p className="eyebrow">STUDENT PROFILE</p><h2>{selected.profile.name}</h2></div><button className="close-modal" onClick={onClose} type="button" aria-label="Close">×</button></div><p className="detail-college">{selected.profile.college?.name}</p><p className="profile-bio">{selected.profile.bio || 'This student has not added a bio yet.'}</p><h3>Skills</h3><div className="skill-list">{selected.profile.skills?.map((item) => <span className="skill-chip" key={item}>{item}</span>)}</div><h3>Interests</h3><div className="skill-list">{selected.profile.interests?.map((item) => <span className="skill-chip" key={item}>{item}</span>)}</div>{selected.profile.portfolioUrl && <a href={selected.profile.portfolioUrl} target="_blank" rel="noreferrer">Portfolio / GitHub ↗</a>}</section></div>
  const post = selected
  return <div className="modal-backdrop"><section className="modal-card" aria-modal="true" role="dialog"><div className="modal-heading"><div><p className="eyebrow">{post.type.replaceAll('_', ' ')}</p><h2>{post.title}</h2></div><button className="close-modal" onClick={onClose} type="button" aria-label="Close">×</button></div><p className="profile-bio">{post.description}</p><div className="skill-list">{post.requiredSkills.map((item) => <span className="skill-chip" key={item}>{item}</span>)}</div><button className="author-info author-button detail-author" onClick={() => onProfile(post.author)} type="button"><span className="author-avatar">{initials(post.author.name)}</span><span className="author-copy"><strong>{post.author.name}</strong><span>{post.author.college?.name}</span></span></button>{post.author.id !== currentUserId && post.status === 'OPEN' && <button className="primary-button" onClick={() => { onClose(); onRequest(post) }} type="button">Collaborate</button>}</section></div>
}

export default App
