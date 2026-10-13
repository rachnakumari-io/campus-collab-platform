const labels = { HELP_REQUEST: 'Help request', PROJECT_TEAM: 'Project team', HACKATHON_TEAM: 'Hackathon team' }

export default function OpportunityCard({ post, currentUserId, onView, onCollaborate, onEdit, onToggleStatus }) {
  const ownPost = post.author.id === currentUserId
  return (
    <article className="opportunity-card">
      <div className="card-topline">
        <span className={`type-badge badge-${post.type.toLowerCase()}`}><span className="type-dot" />{labels[post.type]}</span>
        <span className={`post-status status-${post.status.toLowerCase()}`}>{post.status === 'OPEN' ? 'Open' : 'Closed'}</span>
      </div>
      <button className="post-title-button" onClick={() => onView(post)} type="button"><h2 className="opportunity-title">{post.title}</h2></button>
      <p className="opportunity-description">{post.description}</p>
      <div className="skill-list">{post.requiredSkills.map((skill) => <span className="skill-chip" key={skill}>{skill}</span>)}</div>
      <div className="card-divider" />
      <div className="card-footer">
        <button className="author-info author-button" onClick={() => onView({ profile: post.author })} type="button">
          <span className="author-avatar">{post.author.name.slice(0, 2).toUpperCase()}</span>
          <span className="author-copy"><strong>{post.author.name}</strong><span>{post.author.college?.name}</span></span>
        </button>
        <div className="card-actions">
          <span className="opportunity-meta">{new Date(post.createdAt).toLocaleDateString()} · {post.requestCount ?? 0} requests</span>
          {ownPost ? <><button className="text-button" onClick={() => onEdit(post)} type="button">Edit</button><button className="text-button" onClick={() => onToggleStatus(post)} type="button">{post.status === 'OPEN' ? 'Close' : 'Reopen'}</button></> : <button className="collaborate-button" disabled={post.status !== 'OPEN'} onClick={() => onCollaborate(post)} type="button">Collaborate <span>→</span></button>}
        </div>
      </div>
    </article>
  )
}
