import { useEffect, useMemo, useState } from 'react'
import { NavLink, Routes, Route, Link } from 'react-router-dom'
import { jobs } from './data/jobs'

const DEFAULT_PREFERENCES = {
  roleKeywords: '',
  preferredLocations: [],
  preferredMode: [],
  experienceLevel: '',
  skills: '',
  minMatchScore: 40,
}

function normaliseList(input) {
  if (!input) return []
  return input
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

function computeMatchScore(job, preferences) {
  if (!preferences) return 0
  let score = 0

  const roleKeywords = normaliseList(preferences.roleKeywords)
  const skillPrefs = normaliseList(preferences.skills)
  const preferredLocations = preferences.preferredLocations || []
  const preferredMode = preferences.preferredMode || []
  const expLevel = preferences.experienceLevel || ''

  const title = job.title.toLowerCase()
  const description = job.description.toLowerCase()

  if (roleKeywords.length > 0) {
    if (roleKeywords.some((kw) => title.includes(kw))) {
      score += 25
    }
    if (roleKeywords.some((kw) => description.includes(kw))) {
      score += 15
    }
  }

  if (preferredLocations.length > 0 && preferredLocations.includes(job.location)) {
    score += 15
  }

  if (preferredMode.length > 0 && preferredMode.includes(job.mode)) {
    score += 10
  }

  if (expLevel && job.experience === expLevel) {
    score += 10
  }

  if (skillPrefs.length > 0) {
    const jobSkills = (job.skills || []).map((s) => s.toLowerCase())
    const hasOverlap = skillPrefs.some((s) => jobSkills.includes(s))
    if (hasOverlap) {
      score += 15
    }
  }

  if (job.postedDaysAgo <= 2) {
    score += 5
  }

  if (job.source === 'LinkedIn') {
    score += 5
  }

  return Math.min(100, score)
}

function parseSalaryValue(range) {
  if (!range) return 0
  const text = range.toLowerCase()
  const match = text.match(/(\d+(\.\d+)?)/)
  if (!match) return 0
  const base = parseFloat(match[1])
  if (Number.isNaN(base)) return 0

  if (text.includes('lpa')) {
    return base * 100
  }

  if (text.includes('month')) {
    return base
  }

  return base
}

function getTodayKey() {
  const today = new Date().toISOString().slice(0, 10)
  return { today, key: `jobTrackerDigest_${today}` }
}

function LandingPage() {
  return (
    <section className="context-header">
      <h1 className="page-heading">Stop Missing The Right Jobs.</h1>
      <p className="page-subtext">
        Precision-matched job discovery delivered daily at 9AM.
      </p>
      <div className="button-row">
        <Link to="/settings" className="btn btn--primary">
          Start Tracking
        </Link>
      </div>
    </section>
  )
}

function SettingsPage({ preferences, onChange, jobs }) {
  const uniqueLocations = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.location))).sort(),
    [jobs],
  )
  const uniqueExperiences = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.experience))).sort(),
    [jobs],
  )

  const handleLocationChange = (event) => {
    const options = Array.from(event.target.selectedOptions)
    const values = options.map((opt) => opt.value)
    onChange({ preferredLocations: values })
  }

  const handleModeToggle = (mode) => {
    const current = preferences.preferredMode || []
    if (current.includes(mode)) {
      onChange({ preferredMode: current.filter((m) => m !== mode) })
    } else {
      onChange({ preferredMode: [...current, mode] })
    }
  }

  return (
    <>
      <section className="context-header">
        <h1 className="page-heading">Settings</h1>
        <p className="page-subtext">
          Define how Job Notification Tracker should search on your behalf.
        </p>
      </section>
      <section className="layout">
        <article className="card">
          <div className="field">
            <label htmlFor="role-keywords">Role keywords</label>
            <input
              id="role-keywords"
              placeholder="Example: SDE Intern, React Developer"
              value={preferences.roleKeywords}
              onChange={(e) => onChange({ roleKeywords: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="preferred-locations">Preferred locations</label>
            <select
              id="preferred-locations"
              multiple
              value={preferences.preferredLocations}
              onChange={handleLocationChange}
            >
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
            <div className="field__helper">
              Use Ctrl / Cmd or Shift click to select multiple locations.
            </div>
          </div>

          <div className="field">
            <label>Mode (Remote / Hybrid / Onsite)</label>
            <div className="preferences-modes">
              {['Remote', 'Hybrid', 'Onsite'].map((mode) => (
                <label key={mode} className="preferences-modes__option">
                  <input
                    type="checkbox"
                    checked={preferences.preferredMode.includes(mode)}
                    onChange={() => handleModeToggle(mode)}
                  />
                  <span>{mode}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="experience-level">Experience level</label>
            <select
              id="experience-level"
              value={preferences.experienceLevel}
              onChange={(e) => onChange({ experienceLevel: e.target.value })}
            >
              <option value="">Any level</option>
              {uniqueExperiences.map((exp) => (
                <option key={exp} value={exp}>
                  {exp}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="skills">Skills</label>
            <input
              id="skills"
              placeholder="Example: Java, React, SQL"
              value={preferences.skills}
              onChange={(e) => onChange({ skills: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="min-match-score">
              Minimum match score ({preferences.minMatchScore}%)
            </label>
            <input
              id="min-match-score"
              type="range"
              min="0"
              max="100"
              step="5"
              value={preferences.minMatchScore}
              onChange={(e) => onChange({ minMatchScore: Number(e.target.value) })}
            />
            <div className="field__helper">
              Jobs below this threshold will be hidden when you enable match-only view.
            </div>
          </div>
        </article>
      </section>
    </>
  )
}

function DigestPage({ jobs, preferences, hasPreferences, statusHistory }) {
  const [digestItems, setDigestItems] = useState(null)
  const [status, setStatus] = useState('')

  const digestText = useMemo(() => {
    if (!digestItems || digestItems.length === 0) return ''
    const { today } = getTodayKey()
    const lines = []
    lines.push(`Top 10 Jobs For You — 9AM Digest (${today})`)
    lines.push('')
    digestItems.forEach(({ job, matchScore }, index) => {
      lines.push(`${index + 1}) ${job.title} — ${job.company}`)
      lines.push(`   Location: ${job.location}`)
      lines.push(`   Experience: ${job.experience}`)
      lines.push(`   Match Score: ${matchScore}%`)
      lines.push(`   Apply: ${job.applyUrl}`)
      lines.push('')
    })
    lines.push('This digest was generated based on your preferences.')
    return lines.join('\n')
  }, [digestItems])

  const loadExistingDigest = () => {
    const { key } = getTodayKey()
    if (typeof window === 'undefined') return null
    try {
      const stored = window.localStorage.getItem(key)
      if (!stored) return null
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed)) return null
      const items = parsed
        .map((item) => {
          const job = jobs.find((j) => j.id === item.id)
          if (!job) return null
          return { job, matchScore: item.matchScore ?? computeMatchScore(job, preferences) }
        })
        .filter(Boolean)
      return items.length ? items : null
    } catch {
      return null
    }
  }

  const handleGenerateDigest = () => {
    if (!hasPreferences) return
    const existing = loadExistingDigest()
    if (existing) {
      setDigestItems(existing)
      setStatus('Loaded existing digest for today.')
      return
    }

    const scored = jobs
      .map((job) => ({
        job,
        matchScore: computeMatchScore(job, preferences),
      }))
      .filter(({ matchScore }) => matchScore >= (preferences.minMatchScore ?? 0))
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) {
          return b.matchScore - a.matchScore
        }
        return a.job.postedDaysAgo - b.job.postedDaysAgo
      })
      .slice(0, 10)

    if (!scored.length) {
      setDigestItems([])
      setStatus('No matching roles today.')
      return
    }

    const { key } = getTodayKey()
    const toStore = scored.map(({ job, matchScore }) => ({
      id: job.id,
      matchScore,
    }))
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(toStore))
    }
    setDigestItems(scored)
    setStatus('Generated new digest for today.')
  }

  const handleCopyDigest = async () => {
    if (!digestText) return
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(digestText)
      }
      setStatus('Digest copied to clipboard.')
    } catch {
      setStatus('Unable to copy digest. Please copy manually.')
    }
  }

  const handleCreateEmail = () => {
    if (!digestText) return
    const subject = encodeURIComponent('My 9AM Job Digest')
    const body = encodeURIComponent(digestText)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const hasDigest = !!digestItems && digestItems.length > 0

  return (
    <>
      <section className="context-header">
        <h1 className="page-heading">Daily Digest</h1>
        <p className="page-subtext">
          Generate a calm 9AM-style summary of the strongest matches based on your preferences.
        </p>
      </section>

      {!hasPreferences ? (
        <section className="empty-state">
          <h2 className="empty-state__title">
            Set preferences to generate a personalized digest.
          </h2>
          <p className="empty-state__text">
            Once your ideal roles, locations, and skills are defined, this page will create a
            tailored daily summary for you.
          </p>
        </section>
      ) : (
        <section className="digest-card" aria-label="Daily digest">
          <div className="digest-header">
            <h2 className="digest-header__title">Top 10 Jobs For You — 9AM Digest</h2>
            <p className="digest-header__subtext">{getTodayKey().today}</p>
            <p className="digest-note">Demo Mode: Daily 9AM trigger simulated manually.</p>
          </div>

          <div className="digest-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleGenerateDigest}
            >
              Generate Today&apos;s 9AM Digest (Simulated)
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleCopyDigest}
              disabled={!hasDigest}
            >
              Copy Digest to Clipboard
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleCreateEmail}
              disabled={!hasDigest}
            >
              Create Email Draft
            </button>
          </div>

          {status && <p className="digest-note">{status}</p>}

          {!hasDigest && status === 'No matching roles today.' && (
            <div className="digest-empty">
              No matching roles today. Check again tomorrow.
            </div>
          )}

          {hasDigest && (
            <>
              <div className="digest-list">
                {digestItems.map(({ job, matchScore }) => (
                  <div key={job.id} className="digest-job">
                    <div className="digest-job__title">
                      {job.title} — {job.company}
                    </div>
                    <div className="digest-job__meta">
                      {job.location} · {job.experience} · {job.source}
                    </div>
                    <div className="digest-job__footer">
                      <div className="digest-job__match">Match score: {matchScore}%</div>
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => window.open(job.applyUrl, '_blank', 'noopener,noreferrer')}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <p className="digest-note">
                This digest was generated based on your preferences.
              </p>
            </>
          )}

          {/* Recent Status Updates Section */}
          {statusHistory && statusHistory.length > 0 && (
            <section className="recent-status-updates" aria-label="Recent status updates">
              <h3 className="recent-status-updates__title">Recent Status Updates</h3>
              <div className="recent-status-list">
                {statusHistory.slice(0, 10).map((entry, index) => (
                  <div key={`${entry.jobId}-${entry.timestamp}`} className="recent-status-item">
                    <div className="recent-status-item__header">
                      <span className="recent-status-item__title">{entry.jobTitle}</span>
                      <span className={`badge ${getStatusBadgeClass(entry.status)}`}>
                        {entry.status}
                      </span>
                    </div>
                    <div className="recent-status-item__meta">
                      {entry.company} · {entry.date}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>
      )}
    </>
  )
}

function ProofPage() {
  return (
    <section>
      <h1 className="page-heading">Proof</h1>
      <p className="page-subtext">
        This area will collect artifacts, screenshots, and evidence that your job tracking is
        working as intended.
      </p>
    </section>
  )
}

function TestChecklistPage({ testChecklist, onTestCheck, onReset, passCount }) {
  const testItems = [
    {
      id: 'preferences-persist',
      label: 'Preferences persist after refresh',
      tooltip: 'Set preferences, refresh page, verify they remain'
    },
    {
      id: 'match-score-correct',
      label: 'Match score calculates correctly',
      tooltip: 'Check that scores reflect your preferences accurately'
    },
    {
      id: 'matches-toggle',
      label: '"Show only matches" toggle works',
      tooltip: 'Toggle should filter jobs below your threshold'
    },
    {
      id: 'save-persist',
      label: 'Save job persists after refresh',
      tooltip: 'Save a job, refresh, verify it remains saved'
    },
    {
      id: 'apply-new-tab',
      label: 'Apply opens in new tab',
      tooltip: 'Click Apply button, verify it opens in new tab'
    },
    {
      id: 'status-persist',
      label: 'Status update persists after refresh',
      tooltip: 'Change job status, refresh, verify it remains'
    },
    {
      id: 'status-filter',
      label: 'Status filter works correctly',
      tooltip: 'Filter by status should show correct jobs'
    },
    {
      id: 'digest-top-10',
      label: 'Digest generates top 10 by score',
      tooltip: 'Generate digest, verify it shows 10 highest scoring jobs'
    },
    {
      id: 'digest-persists',
      label: 'Digest persists for the day',
      tooltip: 'Generate digest, refresh, verify it persists'
    },
    {
      id: 'no-console-errors',
      label: 'No console errors on main pages',
      tooltip: 'Check browser console for errors on all main pages'
    }
  ]

  const allTestsPassed = passCount === 10

  return (
    <>
      <section className="context-header">
        <h1 className="page-heading">Test Checklist</h1>
        <p className="page-subtext">
          Built-in quality assurance checklist. Verify all features work before shipping.
        </p>
      </section>

      <section className="test-summary" aria-label="Test summary">
        <div className={`test-summary__status ${allTestsPassed ? 'test-summary__status--passed' : 'test-summary__status--warning'}`}>
          <div className="test-summary__count">
            Tests Passed: {passCount} / 10
          </div>
          {!allTestsPassed && (
            <div className="test-summary__warning">
              Resolve all issues before shipping.
            </div>
          )}
        </div>
        <button 
          type="button" 
          className="btn btn--secondary btn--small"
          onClick={onReset}
        >
          Reset Test Status
        </button>
      </section>

      <section className="test-checklist" aria-label="Test checklist">
        <div className="test-list">
          {testItems.map((item) => (
            <div key={item.id} className="test-item">
              <label className="test-item__label">
                <input
                  type="checkbox"
                  checked={testChecklist[item.id] || false}
                  onChange={(e) => onTestCheck(item.id, e.target.checked)}
                  className="test-item__checkbox"
                />
                <span className="test-item__text">{item.label}</span>
                {item.tooltip && (
                  <span className="test-item__tooltip" title={item.tooltip}>
                    ?
                  </span>
                )}
              </label>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function ShipPage({ allTestsPassed, passCount }) {
  if (allTestsPassed) {
    return (
      <>
        <section className="context-header">
          <h1 className="page-heading">Ship</h1>
          <p className="page-subtext">
            All tests passed. Ready to ship.
          </p>
        </section>
        
        <section className="ship-success" aria-label="Ship ready">
          <div className="ship-success__icon">✓</div>
          <h2 className="ship-success__title">Ready to Ship</h2>
          <p className="ship-success__text">
            All {passCount} tests have passed. The application is ready for deployment.
          </p>
          <div className="ship-success__actions">
            <button type="button" className="btn btn--primary">
              Deploy to Production
            </button>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <section className="context-header">
        <h1 className="page-heading">Ship</h1>
        <p className="page-subtext">
          Complete all tests before shipping.
        </p>
      </section>
      
      <section className="ship-locked" aria-label="Ship locked">
        <div className="ship-locked__icon">🔒</div>
        <h2 className="ship-locked__title">Ship Locked</h2>
        <p className="ship-locked__text">
          Only {passCount} of 10 tests have passed. Complete the test checklist to unlock shipping.
        </p>
        <div className="ship-locked__actions">
          <NavLink to="/jt/07-test" className="btn btn--secondary">
            Complete Test Checklist
          </NavLink>
        </div>
      </section>
    </>
  )
}

function FinalProofPage({ proofSubmission, onSubmissionChange, testChecklist, projectStatus, onCopySubmission }) {
  const validateUrl = (url) => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const getUrlError = (url) => {
    if (!url) return ''
    return validateUrl(url) ? '' : 'Please enter a valid URL'
  }

  const steps = [
    { id: 'preferences', label: 'Set preferences', completed: true },
    { id: 'dashboard', label: 'Review dashboard', completed: true },
    { id: 'status-tracking', label: 'Implement status tracking', completed: true },
    { id: 'status-filter', label: 'Add status filter', completed: true },
    { id: 'notifications', label: 'Add toast notifications', completed: true },
    { id: 'digest-updates', label: 'Add digest status updates', completed: true },
    { id: 'test-checklist', label: 'Create test checklist', completed: true },
    { id: 'ship-lock', label: 'Implement ship validation', completed: true }
  ]

  const completedSteps = steps.filter(step => step.completed).length
  const allTestsPassed = Object.values(testChecklist).filter(Boolean).length === 10
  const allLinksProvided = proofSubmission.lovableProject && proofSubmission.githubRepository && proofSubmission.deployedUrl
  const allLinksValid = validateUrl(proofSubmission.lovableProject) && validateUrl(proofSubmission.githubRepository) && validateUrl(proofSubmission.deployedUrl)
  const canShip = allTestsPassed && allLinksProvided && allLinksValid

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Shipped':
        return 'badge--status-selected'
      case 'In Progress':
        return 'badge--status-applied'
      default:
        return 'badge--status-neutral'
    }
  }

  return (
    <>
      <section className="context-header">
        <h1 className="page-heading">Final Proof</h1>
        <p className="page-subtext">
          Complete project submission and validation for Job Notification Tracker.
        </p>
      </section>

      <section className="project-summary" aria-label="Project summary">
        <h2 className="project-summary__title">Project 1 — Job Notification Tracker</h2>
        <div className="project-summary__status">
          <span className={`badge ${getStatusBadgeClass(projectStatus)}`}>
            {projectStatus}
          </span>
        </div>
      </section>

      <section className="step-completion" aria-label="Step completion">
        <h3 className="step-completion__title">A) Step Completion Summary</h3>
        <div className="step-list">
          {steps.map((step, index) => (
            <div key={step.id} className="step-item">
              <div className="step-item__number">{index + 1}</div>
              <div className="step-item__content">
                <span className="step-item__label">{step.label}</span>
                <span className={`step-item__status ${step.completed ? 'step-item__status--completed' : 'step-item__status--pending'}`}>
                  {step.completed ? 'Completed' : 'Pending'}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="step-completion__summary">
          Steps Completed: {completedSteps} / {steps.length}
        </div>
      </section>

      <section className="artifact-collection" aria-label="Artifact collection">
        <h3 className="artifact-collection__title">B) Artifact Collection Inputs</h3>
        <div className="artifact-form">
          <div className="artifact-field">
            <label htmlFor="lovable-project" className="artifact-field__label">
              Lovable Project Link
            </label>
            <input
              id="lovable-project"
              type="url"
              placeholder="https://lovable.app/projects/..."
              value={proofSubmission.lovableProject}
              onChange={(e) => onSubmissionChange('lovableProject', e.target.value)}
              className={`artifact-field__input ${getUrlError(proofSubmission.lovableProject) ? 'artifact-field__input--error' : ''}`}
            />
            {getUrlError(proofSubmission.lovableProject) && (
              <div className="artifact-field__error">{getUrlError(proofSubmission.lovableProject)}</div>
            )}
          </div>

          <div className="artifact-field">
            <label htmlFor="github-repository" className="artifact-field__label">
              GitHub Repository Link
            </label>
            <input
              id="github-repository"
              type="url"
              placeholder="https://github.com/username/repository"
              value={proofSubmission.githubRepository}
              onChange={(e) => onSubmissionChange('githubRepository', e.target.value)}
              className={`artifact-field__input ${getUrlError(proofSubmission.githubRepository) ? 'artifact-field__input--error' : ''}`}
            />
            {getUrlError(proofSubmission.githubRepository) && (
              <div className="artifact-field__error">{getUrlError(proofSubmission.githubRepository)}</div>
            )}
          </div>

          <div className="artifact-field">
            <label htmlFor="deployed-url" className="artifact-field__label">
              Deployed URL (Vercel or equivalent)
            </label>
            <input
              id="deployed-url"
              type="url"
              placeholder="https://your-app.vercel.app"
              value={proofSubmission.deployedUrl}
              onChange={(e) => onSubmissionChange('deployedUrl', e.target.value)}
              className={`artifact-field__input ${getUrlError(proofSubmission.deployedUrl) ? 'artifact-field__input--error' : ''}`}
            />
            {getUrlError(proofSubmission.deployedUrl) && (
              <div className="artifact-field__error">{getUrlError(proofSubmission.deployedUrl)}</div>
            )}
          </div>
        </div>
      </section>

      <section className="submission-export" aria-label="Submission export">
        <h3 className="submission-export__title">Final Submission Export</h3>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onCopySubmission}
          disabled={!canShip}
        >
          Copy Final Submission
        </button>
        {!canShip && (
          <div className="submission-export__requirements">
            <p>Requirements to enable submission:</p>
            <ul className="submission-export__list">
              {!allTestsPassed && <li>All 10 test checklist items must be passed</li>}
              {!allLinksProvided && <li>All 3 artifact links must be provided</li>}
              {allLinksProvided && !allLinksValid && <li>All links must be valid URLs</li>}
            </ul>
          </div>
        )}
      </section>

      {projectStatus === 'Shipped' && (
        <section className="completion-message" aria-label="Completion message">
          <div className="completion-message__content">
            <div className="completion-message__icon">✓</div>
            <h3 className="completion-message__title">Project 1 Shipped Successfully.</h3>
            <p className="completion-message__text">
              All requirements have been met and the project is ready for submission.
            </p>
          </div>
        </section>
      )}
    </>
  )
}

function getMatchBadgeClass(score) {
  if (score >= 80) return 'badge--match-high'
  if (score >= 60) return 'badge--match-medium'
  if (score >= 40) return 'badge--match-low'
  return 'badge--match-muted'
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'Applied':
      return 'badge--status-applied'
    case 'Rejected':
      return 'badge--status-rejected'
    case 'Selected':
      return 'badge--status-selected'
    default:
      return 'badge--status-neutral'
  }
}

function JobCard({ job, matchScore, isSaved, jobStatuses, onStatusChange, onView, onToggleSave, onApply }) {
  const currentStatus = jobStatuses[job.id] || 'Not Applied'
  const metaLocation = `${job.location} · ${job.mode}`

  const postedLabel =
    job.postedDaysAgo === 0
      ? 'Today'
      : job.postedDaysAgo === 1
        ? '1 day ago'
        : `${job.postedDaysAgo} days ago`

  const handleStatusClick = (newStatus) => {
    onStatusChange(job.id, newStatus)
  }

  return (
    <article className="job-card">
      <div className="job-card__header">
        <div>
          <h2 className="job-card__title">{job.title}</h2>
          <div className="job-card__company">{job.company}</div>
          <div className="job-card__meta">
            <span>{metaLocation}</span>
            <span>{job.experience} years</span>
            <span>{job.salaryRange}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <span className={`badge ${getMatchBadgeClass(matchScore)}`}>
            {matchScore}% match
          </span>
          <span className={`badge ${getStatusBadgeClass(currentStatus)}`}>
            {currentStatus}
          </span>
          <span className="badge badge--source">{job.source}</span>
          <span className="badge badge--mode">{job.mode}</span>
          <span className="badge badge--experience">{job.experience}</span>
        </div>
      </div>
      <div className="job-card__footer">
        <div className="job-card__footer-left">Posted {postedLabel}</div>
        <div className="job-card__footer-actions">
          <div className="status-buttons">
            {['Not Applied', 'Applied', 'Rejected', 'Selected'].map((status) => (
              <button
                key={status}
                type="button"
                className={`btn btn--status ${currentStatus === status ? 'btn--status-active' : ''}`}
                onClick={() => handleStatusClick(status)}
              >
                {status}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => onView(job)}>
            View
          </button>
          <button
            type="button"
            className={`btn ${isSaved ? 'btn--saved' : 'btn--secondary'}`}
            onClick={() => onToggleSave(job.id)}
          >
            {isSaved ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onApply(job.applyUrl)}
          >
            Apply
          </button>
        </div>
      </div>
    </article>
  )
}

function JobModal({ job, onClose }) {
  if (!job) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <h2 id="job-modal-title" className="modal__title">
              {job.title}
            </h2>
            <div className="modal__company">
              {job.company} · {job.location} · {job.mode}
            </div>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal__body">{job.description}</div>
        <div className="modal__skills">
          {job.skills.map((skill) => (
            <span key={skill} className="modal__skills-tag">
              {skill}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function JobsDashboard({ jobs, savedJobIds, jobStatuses, preferences, hasPreferences, onToggleSave, onStatusChange, onApply }) {
  const [selectedJob, setSelectedJob] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('')
  const [mode, setMode] = useState('')
  const [experience, setExperience] = useState('')
  const [source, setSource] = useState('')
  const [sort, setSort] = useState('latest')
  const [showOnlyMatches, setShowOnlyMatches] = useState(false)
  const [statusFilter, setStatusFilter] = useState('All')

  const uniqueLocations = Array.from(new Set(jobs.map((j) => j.location))).sort()
  const uniqueModes = Array.from(new Set(jobs.map((j) => j.mode))).sort()
  const uniqueExperiences = Array.from(new Set(jobs.map((j) => j.experience))).sort()
  const uniqueSources = Array.from(new Set(jobs.map((j) => j.source))).sort()

  const jobsWithScores = useMemo(
    () =>
      jobs.map((job) => ({
        job,
        matchScore: computeMatchScore(job, preferences),
      })),
    [jobs, preferences],
  )

  let filteredJobs = jobsWithScores
    .filter(({ job }) => {
      const term = keyword.trim().toLowerCase()
      if (!term) return true
      return (
        job.title.toLowerCase().includes(term) || job.company.toLowerCase().includes(term)
      )
    })
    .filter(({ job }) => (location ? job.location === location : true))
    .filter(({ job }) => (mode ? job.mode === mode : true))
    .filter(({ job }) => (experience ? job.experience === experience : true))
    .filter(({ job }) => (source ? job.source === source : true))
    .filter(({ job }) => {
      if (statusFilter === 'All') return true
      const currentStatus = jobStatuses[job.id] || 'Not Applied'
      return currentStatus === statusFilter
    })

  if (showOnlyMatches && hasPreferences) {
    filteredJobs = filteredJobs.filter(
      ({ matchScore }) => matchScore >= (preferences.minMatchScore ?? 0),
    )
  }

  filteredJobs = [...filteredJobs].sort((a, b) => {
    if (sort === 'latest') {
      return a.job.postedDaysAgo - b.job.postedDaysAgo
    }
    if (sort === 'match') {
      return b.matchScore - a.matchScore
    }
    if (sort === 'salary') {
      return parseSalaryValue(b.job.salaryRange) - parseSalaryValue(a.job.salaryRange)
    }
    return 0
  })

  return (
    <>
      <section className="context-header">
        <h1 className="page-heading">Dashboard</h1>
        <p className="page-subtext">
          Review all current roles being tracked. Use filters to narrow down what matters today.
        </p>
      </section>

      {!hasPreferences && (
        <section className="info-banner" aria-label="Preferences hint">
          <div className="info-banner__title">
            Set your preferences to activate intelligent matching.
          </div>
          <p className="info-banner__text">
            Your dashboard will calculate a match score for each role once you define what you are
            looking for.
          </p>
        </section>
      )}

      <section className="filter-card" aria-label="Job filters">
        <div className="filters-row">
          <div className="filters-field">
            <label htmlFor="filter-keyword">Keyword</label>
            <input
              id="filter-keyword"
              type="text"
              placeholder="Search by title or company"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div className="filters-field">
            <label htmlFor="filter-location">Location</label>
            <select
              id="filter-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              <option value="">All locations</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
          <div className="filters-field">
            <label htmlFor="filter-mode">Mode</label>
            <select
              id="filter-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="">All modes</option>
              {uniqueModes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filters-row">
          <div className="filters-field">
            <label htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All statuses</option>
              <option value="Not Applied">Not Applied</option>
              <option value="Applied">Applied</option>
              <option value="Rejected">Rejected</option>
              <option value="Selected">Selected</option>
            </select>
          </div>
          <div className="filters-field">
            <label htmlFor="filter-experience">Experience</label>
            <select
              id="filter-experience"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
            >
              <option value="">All levels</option>
              {uniqueExperiences.map((exp) => (
                <option key={exp} value={exp}>
                  {exp}
                </option>
              ))}
            </select>
          </div>
          <div className="filters-field">
            <label htmlFor="filter-source">Source</label>
            <select
              id="filter-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">All sources</option>
              {uniqueSources.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filters-row">
          <div className="filters-field">
            <label htmlFor="filter-sort">Sort</label>
            <select
              id="filter-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="latest">Latest first</option>
              <option value="match">Match score</option>
              <option value="salary">Salary (approx)</option>
            </select>
          </div>
        </div>
        <div className="toggle-row">
          <label className="toggle-row__label">
            <input
              type="checkbox"
              checked={showOnlyMatches && hasPreferences}
              onChange={(e) => setShowOnlyMatches(e.target.checked)}
              disabled={!hasPreferences}
            />
            <span>Show only jobs above my threshold</span>
          </label>
        </div>
      </section>

      {filteredJobs.length === 0 ? (
        <section className="empty-state">
          <h2 className="empty-state__title">No roles match your criteria.</h2>
          <p className="empty-state__text">
            Adjust filters, update your preferences, or lower your minimum match threshold to see
            more roles.
          </p>
        </section>
      ) : (
        <section className="job-list" aria-label="Job results">
          {filteredJobs.map(({ job, matchScore }) => (
            <JobCard
              key={job.id}
              job={job}
              matchScore={matchScore}
              isSaved={savedJobIds.includes(job.id)}
              jobStatuses={jobStatuses}
              onStatusChange={onStatusChange}
              onView={setSelectedJob}
              onToggleSave={onToggleSave}
              onApply={onApply}
            />
          ))}
        </section>
      )}

      <JobModal job={selectedJob} onClose={() => setSelectedJob(null)} />
    </>
  )
}

function SavedJobs({ jobs, savedJobIds, jobStatuses, preferences, onToggleSave, onStatusChange, onApply }) {
  const [selectedJob, setSelectedJob] = useState(null)
  const savedJobsWithScores = useMemo(
    () =>
      jobs
        .filter((job) => savedJobIds.includes(job.id))
        .map((job) => ({ job, matchScore: computeMatchScore(job, preferences) })),
    [jobs, savedJobIds, preferences],
  )

  if (savedJobsWithScores.length === 0) {
    return (
      <section className="context-header">
        <h1 className="page-heading">Saved</h1>
        <p className="page-subtext">
          You have not saved any roles yet. As you review the dashboard, mark promising jobs to
          keep them organised here.
        </p>
      </section>
    )
  }

  return (
    <>
      <section className="context-header">
        <h1 className="page-heading">Saved</h1>
        <p className="page-subtext">
          A calm list of roles you have chosen to watch closely. Review and apply at your own pace.
        </p>
      </section>

      <section className="job-list" aria-label="Saved jobs">
        {savedJobsWithScores.map(({ job, matchScore }) => (
          <JobCard
            key={job.id}
            job={job}
            matchScore={matchScore}
            isSaved
            jobStatuses={jobStatuses}
            onStatusChange={onStatusChange}
            onView={setSelectedJob}
            onToggleSave={onToggleSave}
            onApply={onApply}
          />
        ))}
      </section>

      <JobModal job={selectedJob} onClose={() => setSelectedJob(null)} />
    </>
  )
}

function App() {
  const [navOpen, setNavOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [savedJobIds, setSavedJobIds] = useState(() => {
    if (typeof window === 'undefined') return []
    try {
      const stored = window.localStorage.getItem('jnt_saved_jobs')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const [jobStatuses, setJobStatuses] = useState(() => {
    if (typeof window === 'undefined') return {}
    try {
      const stored = window.localStorage.getItem('jobTrackerStatus')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  const [statusHistory, setStatusHistory] = useState(() => {
    if (typeof window === 'undefined') return []
    try {
      const stored = window.localStorage.getItem('jobTrackerStatusHistory')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const [testChecklist, setTestChecklist] = useState(() => {
    if (typeof window === 'undefined') return {}
    try {
      const stored = window.localStorage.getItem('jobTrackerTestChecklist')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  const [proofSubmission, setProofSubmission] = useState(() => {
    if (typeof window === 'undefined') return {
      lovableProject: '',
      githubRepository: '',
      deployedUrl: ''
    }
    try {
      const stored = window.localStorage.getItem('jobTrackerProofSubmission')
      return stored ? JSON.parse(stored) : {
        lovableProject: '',
        githubRepository: '',
        deployedUrl: ''
      }
    } catch {
      return {
        lovableProject: '',
        githubRepository: '',
        deployedUrl: ''
      }
    }
  })

  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  const [hasPreferences, setHasPreferences] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('jnt_saved_jobs', JSON.stringify(savedJobIds))
  }, [savedJobIds])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('jobTrackerStatus', JSON.stringify(jobStatuses))
  }, [jobStatuses])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('jobTrackerStatusHistory', JSON.stringify(statusHistory))
  }, [statusHistory])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('jobTrackerTestChecklist', JSON.stringify(testChecklist))
  }, [testChecklist])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('jobTrackerProofSubmission', JSON.stringify(proofSubmission))
  }, [proofSubmission])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem('jobTrackerPreferences')
      if (stored) {
        const parsed = JSON.parse(stored)
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed })
        setHasPreferences(true)
      }
    } catch {
      // ignore
    }
  }, [])

  const handlePreferencesChange = (partial) => {
    setPreferences((prev) => {
      const next = { ...prev, ...partial }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('jobTrackerPreferences', JSON.stringify(next))
      }
      return next
    })
    setHasPreferences(true)
  }

  const handleToggleSave = (id) => {
    setSavedJobIds((prev) =>
      prev.includes(id) ? prev.filter((jobId) => jobId !== id) : [...prev, id],
    )
  }

  const handleStatusChange = (jobId, newStatus) => {
    const previousStatus = jobStatuses[jobId] || 'Not Applied'
    setJobStatuses((prev) => ({
      ...prev,
      [jobId]: newStatus,
    }))
    
    // Add to status history if status actually changed and it's one of the tracked statuses
    if (previousStatus !== newStatus && ['Applied', 'Rejected', 'Selected'].includes(newStatus)) {
      const job = jobs.find(j => j.id === jobId)
      if (job) {
        const historyEntry = {
          jobId,
          jobTitle: job.title,
          company: job.company,
          status: newStatus,
          timestamp: new Date().toISOString(),
          date: new Date().toLocaleDateString()
        }
        setStatusHistory(prev => [historyEntry, ...prev].slice(0, 20)) // Keep last 20 entries
      }
      
      // Show toast
      setToast(`Status updated: ${newStatus}`)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const handleApply = (url) => {
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleTestCheck = (testId, checked) => {
    setTestChecklist(prev => ({
      ...prev,
      [testId]: checked
    }))
  }

  const resetTestStatus = () => {
    setTestChecklist({})
  }

  const getTestPassCount = () => {
    return Object.values(testChecklist).filter(Boolean).length
  }

  const allTestsPassed = getTestPassCount() === 10

  const handleProofSubmissionChange = (field, value) => {
    setProofSubmission(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const validateUrl = (url) => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const getProjectStatus = () => {
    const allLinksProvided = proofSubmission.lovableProject && 
                           proofSubmission.githubRepository && 
                           proofSubmission.deployedUrl
    const allLinksValid = validateUrl(proofSubmission.lovableProject) &&
                         validateUrl(proofSubmission.githubRepository) &&
                         validateUrl(proofSubmission.deployedUrl)
    
    if (allTestsPassed && allLinksProvided && allLinksValid) {
      return 'Shipped'
    } else if (allTestsPassed || (proofSubmission.lovableProject || proofSubmission.githubRepository || proofSubmission.deployedUrl)) {
      return 'In Progress'
    } else {
      return 'Not Started'
    }
  }

  const copyFinalSubmission = async () => {
    const submissionText = `------------------------------------------
Job Notification Tracker — Final Submission

Lovable Project:
${proofSubmission.lovableProject}

GitHub Repository:
${proofSubmission.githubRepository}

Live Deployment:
${proofSubmission.deployedUrl}

Core Features:
- Intelligent match scoring
- Daily digest simulation
- Status tracking
- Test checklist enforced
------------------------------------------`
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(submissionText)
        setToast('Final submission copied to clipboard')
        setTimeout(() => setToast(null), 3000)
      }
    } catch {
      setToast('Unable to copy submission. Please copy manually.')
      setTimeout(() => setToast(null), 3000)
    }
  }

  const navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/saved', label: 'Saved' },
    { path: '/digest', label: 'Digest' },
    { path: '/settings', label: 'Settings' },
    { path: '/jt/07-test', label: 'Test Checklist' },
    { path: '/jt/08-ship', label: 'Ship' },
    { path: '/jt/proof', label: 'Final Proof' },
    { path: '/proof', label: 'Proof' },
  ]

  return (
    <div className="page">
      <header className="top-bar">
        <div className="top-bar__project">Job Notification Tracker</div>

        <nav className="top-bar__nav" aria-label="Primary">
          <button
            type="button"
            className="nav-toggle"
            aria-label="Toggle navigation"
            onClick={() => setNavOpen((open) => !open)}
          >
            <span />
          </button>
          <div className={`nav-links ${navOpen ? '' : 'nav-links--hidden'}`}>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                className={({ isActive }) =>
                  `nav-link${isActive ? ' nav-link--active' : ''}`
                }
                onClick={() => setNavOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="content">
        <div className="content-inner">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/dashboard"
              element={
                <JobsDashboard
                  jobs={jobs}
                  savedJobIds={savedJobIds}
                  jobStatuses={jobStatuses}
                  preferences={preferences}
                  hasPreferences={hasPreferences}
                  onToggleSave={handleToggleSave}
                  onStatusChange={handleStatusChange}
                  onApply={handleApply}
                />
              }
            />
            <Route
              path="/saved"
              element={
                <SavedJobs
                  jobs={jobs}
                  savedJobIds={savedJobIds}
                  jobStatuses={jobStatuses}
                  preferences={preferences}
                  onToggleSave={handleToggleSave}
                  onStatusChange={handleStatusChange}
                  onApply={handleApply}
                />
              }
            />
            <Route
              path="/digest"
              element={
                <DigestPage
                  jobs={jobs}
                  preferences={preferences}
                  hasPreferences={hasPreferences}
                  statusHistory={statusHistory}
                />
              }
            />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  preferences={preferences}
                  onChange={handlePreferencesChange}
                  jobs={jobs}
                />
              }
            />
            <Route path="/proof" element={<ProofPage />} />
            <Route 
              path="/jt/07-test" 
              element={
                <TestChecklistPage 
                  testChecklist={testChecklist}
                  onTestCheck={handleTestCheck}
                  onReset={resetTestStatus}
                  passCount={getTestPassCount()}
                />
              } 
            />
            <Route 
              path="/jt/08-ship" 
              element={
                <ShipPage 
                  allTestsPassed={allTestsPassed}
                  passCount={getTestPassCount()}
                />
              } 
            />
            <Route 
              path="/jt/proof" 
              element={
                <FinalProofPage 
                  proofSubmission={proofSubmission}
                  onSubmissionChange={handleProofSubmissionChange}
                  testChecklist={testChecklist}
                  projectStatus={getProjectStatus()}
                  onCopySubmission={copyFinalSubmission}
                />
              } 
            />
          </Routes>
        </div>
      </main>
      {toast && (
        <div className="toast">
          {toast}
        </div>
      )}
    </div>
  )
}

export default App
