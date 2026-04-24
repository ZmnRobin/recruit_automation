import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useTaskStream } from '../hooks/useTaskStream';
import { useToast } from '../components/Toast';

/* ─── Quick-reply suggestions ────────────────────────────────────────────── */
const QUICK_REPLIES = [
  "Yes, I'm very interested!",
  "Thanks but I'm not looking right now.",
  "Can you share more details?",
  "What's the salary range?",
  "I'd love to schedule a call.",
];

/* ─── Animated SVG score ring ───────────────────────────────────────────── */
function ScoreRing({ value, color }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(value ?? 0), 120);
    return () => clearTimeout(t);
  }, [value]);

  const dash = (animated / 100) * circ;

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <defs>
        <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle cx="70" cy="70" r={r} fill="none" stroke="#e9ecef" strokeWidth="10" />
      {/* Progress */}
      <circle
        cx="70" cy="70" r={r}
        fill="none"
        stroke="url(#scoreGrad)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset="0"
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
      <text x="70" y="65" textAnchor="middle" fill={color}
        style={{ fontSize: '28px', fontWeight: '700', fontFamily: 'inherit' }}>
        {value ?? '—'}
      </text>
      <text x="70" y="84" textAnchor="middle" fill="#adb5bd"
        style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
        / 100
      </text>
    </svg>
  );
}

/* ─── Chat bubble ────────────────────────────────────────────────────────── */
function Bubble({ msg }) {
  const out = msg.direction === 'outbound';
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: out ? 'flex-end' : 'flex-start',
      marginBottom: '1rem',
      animation: 'bubbleIn 0.22s ease',
    }}>
      <div style={{
        maxWidth: '78%',
        padding: '0.75rem 1rem',
        borderRadius: out ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: out ? '#1a1a2e' : '#f8f9fa',
        color: out ? '#fff' : '#212529',
        fontSize: '0.875rem',
        lineHeight: '1.55',
        boxShadow: out
          ? '0 3px 10px rgba(26,26,46,0.2)'
          : '0 2px 6px rgba(0,0,0,0.06)',
        border: out ? 'none' : '1px solid #e9ecef',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '4px' }}>
        {msg.intent && (
          <span style={{
            fontSize: '0.6875rem',
            padding: '2px 8px',
            borderRadius: '10px',
            background: msg.intent === 'interested' ? '#d4edda'
              : msg.intent === 'not_interested' ? '#f8d7da'
              : '#fff3cd',
            color: msg.intent === 'interested' ? '#155724'
              : msg.intent === 'not_interested' ? '#721c24'
              : '#856404',
            fontWeight: 600,
          }}>
            {msg.intent === 'interested' ? '✦ Interested'
              : msg.intent === 'not_interested' ? '✕ Not interested'
              : '● Neutral'}
          </span>
        )}
        <span style={{ fontSize: '0.6875rem', color: '#adb5bd' }}>
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        {msg.scheduledLink && (
          <a href={msg.scheduledLink} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '0.6875rem', color: '#1a1a2e', textDecoration: 'none' }}>
            📅 Schedule
          </a>
        )}
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function CandidateDetails() {
  const { id } = useParams();
  const { toast, updateToast } = useToast();

  const [candidate, setCandidate] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responseMessage, setResponseMessage] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);

  const [scoringTaskId, setScoringTaskId] = useState(null);
  const [scoringToastId, setScoringToastId] = useState(null);
  const [outreachTaskId, setOutreachTaskId] = useState(null);
  const [outreachToastId, setOutreachToastId] = useState(null);

  const chatEndRef = useRef(null);

  useEffect(() => { loadData(); }, [id]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadData = async () => {
    try {
      const [cRes, mRes] = await Promise.all([
        api.getCandidate(id),
        api.getCandidateMessages(id),
      ]);
      setCandidate(cRes.data.data);
      setMessages(mRes.data.data.slice().reverse());
    } catch (err) {
      toast({ type: 'error', title: 'Load failed', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  /* ── Scoring stream ── */
  useTaskStream(scoringTaskId, {
    onUpdate: (d) => scoringToastId && updateToast(scoringToastId, {
      message: `Analysing… ${d.progress ?? 0}%`, progress: d.progress ?? 0,
    }),
    onComplete: (d) => {
      scoringToastId && updateToast(scoringToastId, {
        type: 'success', title: 'Score ready',
        message: `${d.result?.value}/100 — ${d.result?.reasoning ?? ''}`, progress: 100,
      });
      setScoringTaskId(null);
      loadData();
    },
    onError: (d) => {
      scoringToastId && updateToast(scoringToastId, {
        type: 'error', title: 'Scoring failed', message: d.error,
      });
      setScoringTaskId(null);
    },
  });

  /* ── Outreach stream ── */
  useTaskStream(outreachTaskId, {
    onUpdate: (d) => outreachToastId && updateToast(outreachToastId, {
      message: `Generating message… ${d.progress ?? 0}%`, progress: d.progress ?? 0,
    }),
    onComplete: () => {
      outreachToastId && updateToast(outreachToastId, {
        type: 'success', title: 'Outreach sent', message: 'Message delivered.', progress: 100,
      });
      setOutreachTaskId(null);
      loadData();
    },
    onError: (d) => {
      outreachToastId && updateToast(outreachToastId, {
        type: 'error', title: 'Outreach failed', message: d.error,
      });
      setOutreachTaskId(null);
    },
  });

  const handleScore = async () => {
    try {
      const res = await api.scoreCandidate(id);
      const taskId = res.data.data?.taskId;
      if (!taskId) {
        toast({ type: 'info', title: 'Cached', message: 'Score loaded from cache.' });
        loadData();
        return;
      }
      const tid = toast({ type: 'loading', title: 'Scoring candidate', message: 'Analysing… 0%', progress: 0 });
      setScoringTaskId(taskId);
      setScoringToastId(tid);
    } catch (err) {
      toast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleOutreach = async () => {
    if (!candidate?.jobId) {
      toast({ type: 'error', title: 'No job linked', message: 'Candidate has no associated job.' });
      return;
    }
    try {
      const res = await api.outreachCandidate(id, candidate.jobId._id);
      const taskId = res.data.data?.taskId;
      const tid = toast({ type: 'loading', title: 'Sending outreach', message: 'Generating message… 0%', progress: 0 });
      setOutreachTaskId(taskId);
      setOutreachToastId(tid);
    } catch (err) {
      toast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const sendResponse = async (text) => {
    if (!text.trim() || sendingResponse) return;
    try {
      setSendingResponse(true);
      setResponseMessage('');
      await api.respondToCandidate(id, text);
      loadData();
    } catch (err) {
      toast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setSendingResponse(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendResponse(responseMessage);
    }
  };

  /* ── Score color (same logic as original) ── */
  const scoreVal = candidate?.score?.value;
  const scoreColor = !scoreVal ? '#adb5bd'
    : scoreVal >= 80 ? '#28a745'
    : scoreVal >= 60 ? '#ffc107'
    : '#dc3545';

  /* ── Status badge (same palette as original) ── */
  const statusStyle = (status) => {
    if (status === 'interested') return { background: '#d4edda', color: '#155724' };
    if (status === 'not_interested') return { background: '#f8d7da', color: '#721c24' };
    if (status === 'contacted') return { background: '#fff3cd', color: '#856404' };
    if (status === 'scored') return { background: '#d1ecf1', color: '#0c5460' };
    return { background: '#e2e3e5', color: '#383d41' };
  };

  const scoringActive = !!scoringTaskId;
  const outreachActive = !!outreachTaskId;

  if (loading) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading...</div>
  );
  if (!candidate) return (
    <div style={{ padding: '2rem', color: '#666' }}>Candidate not found.</div>
  );

  const initials = candidate.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const ss = statusStyle(candidate.status);

  return (
    <>
      <style>{`
        @keyframes bubbleIn { from { opacity:0; transform:translateY(5px) } to { opacity:1; transform:none } }
        @keyframes spin     { to   { transform: rotate(360deg) } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #f8f9fa; }
        ::-webkit-scrollbar-thumb { background: #dee2e6; border-radius: 3px; }
        textarea:focus { outline: none; border-color: #1a1a2e !important; box-shadow: 0 0 0 3px rgba(26,26,46,0.08) !important; }
        .quick-chip:hover  { background: #e9ecef !important; border-color: #adb5bd !important; color: #1a1a2e !important; }
        .rescore-btn:hover { background: #f8f9fa !important; color: #1a1a2e !important; }
        .outreach-btn:hover:not(:disabled) { background: #12122a !important; box-shadow: 0 4px 16px rgba(26,26,46,0.3) !important; }
        .send-btn:hover:not(:disabled) { background: #12122a !important; }
      `}</style>

      <div style={S.page}>
        <Link to="/candidates" style={S.backLink}>← Back to Candidates</Link>

        <div style={S.layout}>

          {/* ══ LEFT SIDEBAR ══ */}
          <aside style={S.aside}>

            {/* Hero card */}
            <div style={S.card}>
              <div style={S.avatar}>{initials}</div>
              <h1 style={S.name}>{candidate.name}</h1>
              <p style={S.roleText}>{candidate.currentRole}</p>
              <span style={{ ...S.badge, ...ss }}>{candidate.status}</span>
              {candidate.jobId && (
                <Link to={`/jobs/${candidate.jobId._id}`} style={S.jobChip}>
                  ↗ {candidate.jobId.title}
                </Link>
              )}
            </div>

            {/* Score card */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.25rem' }}>
                <span style={S.sectionTitle}>AI Match Score</span>
                <button
                  className="rescore-btn"
                  onClick={handleScore}
                  disabled={scoringActive}
                  style={{ ...S.rescoreBtn, opacity: scoringActive ? 0.5 : 1 }}
                >
                  {scoringActive ? '…' : '↻ Rescore'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', margin: '0.25rem 0' }}>
                <ScoreRing value={scoreVal} color={scoreColor} />
              </div>

              {candidate.score?.reasoning
                ? <p style={S.reasoning}>{candidate.score.reasoning}</p>
                : <p style={{ ...S.reasoning, color: '#adb5bd', textAlign: 'center' }}>Not scored yet</p>
              }
              {candidate.score?.scoredAt && (
                <p style={S.scoreDate}>
                  Scored {new Date(candidate.score.scoredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>

            {/* Profile stats */}
            <div style={S.card}>
              <span style={{ ...S.sectionTitle, alignSelf: 'flex-start' }}>Profile</span>
              <div style={{ width: '100%', marginTop: '0.5rem' }}>
                {[
                  { label: 'Experience', value: candidate.experience || '—' },
                  { label: 'Location',   value: candidate.location   || '—' },
                  { label: 'Email',      value: candidate.email      || '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={S.statRow}>
                    <span style={S.statLabel}>{label}</span>
                    <span style={S.statValue}>{value}</span>
                  </div>
                ))}
                {candidate.linkedinUrl && (
                  <div style={S.statRow}>
                    <span style={S.statLabel}>LinkedIn</span>
                    <a href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer" style={S.inlineLink}>
                      View Profile →
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Skills */}
            {candidate.skills?.length > 0 && (
              <div style={S.card}>
                <span style={{ ...S.sectionTitle, alignSelf: 'flex-start' }}>Skills</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.625rem', width: '100%' }}>
                  {candidate.skills.map((skill, i) => (
                    <span key={i} style={S.skillPill}>{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Outreach CTA */}
            <button
              className="outreach-btn"
              onClick={handleOutreach}
              disabled={outreachActive}
              style={{ ...S.outreachBtn, opacity: outreachActive ? 0.6 : 1, cursor: outreachActive ? 'not-allowed' : 'pointer' }}
            >
              {outreachActive ? 'Generating message…' : '✉  Send AI Outreach'}
            </button>
          </aside>

          {/* ══ CHAT PANEL ══ */}
          <main style={S.chatPanel}>

            {/* Header */}
            <div style={S.chatHeader}>
              <div>
                <h2 style={S.chatTitle}>Conversation</h2>
                <p style={S.chatSub}>{messages.length} message{messages.length !== 1 ? 's' : ''}</p>
              </div>
              <span style={{
                ...S.badge,
                ...(messages.some(m => m.direction === 'inbound')
                  ? { background: '#d4edda', color: '#155724' }
                  : { background: '#e2e3e5', color: '#6c757d' }),
                fontSize: '0.6875rem',
              }}>
                {messages.some(m => m.direction === 'inbound') ? '● Replied' : '● Awaiting reply'}
              </span>
            </div>

            {/* Messages */}
            <div style={S.messages}>
              {messages.length === 0 ? (
                <div style={S.emptyState}>
                  <span style={{ fontSize: '2.5rem', opacity: 0.18 }}>✉</span>
                  <p style={{ color: '#6c757d', marginTop: '0.75rem', fontWeight: 500 }}>No messages yet</p>
                  <p style={{ color: '#adb5bd', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                    Send an outreach message to start the conversation.
                  </p>
                </div>
              ) : (
                messages.map(msg => <Bubble key={msg._id} msg={msg} />)
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick replies */}
            <div style={S.quickBar}>
              <span style={S.quickLabel}>Simulate:</span>
              <div style={{ display: 'flex', gap: '0.375rem', overflowX: 'auto', paddingBottom: '2px' }}>
                {QUICK_REPLIES.map((qr, i) => (
                  <button
                    key={i}
                    className="quick-chip"
                    onClick={() => sendResponse(qr)}
                    disabled={sendingResponse}
                    style={S.chip}
                  >
                    {qr}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div style={S.inputRow}>
              <textarea
                value={responseMessage}
                onChange={e => setResponseMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a candidate reply… (Enter to send, Shift+Enter for newline)"
                rows={2}
                style={S.textarea}
              />
              <button
                className="send-btn"
                onClick={() => sendResponse(responseMessage)}
                disabled={sendingResponse || !responseMessage.trim()}
                style={{
                  ...S.sendBtn,
                  opacity: (!responseMessage.trim() || sendingResponse) ? 0.4 : 1,
                  cursor: (!responseMessage.trim() || sendingResponse) ? 'not-allowed' : 'pointer',
                }}
              >
                {sendingResponse
                  ? <span style={S.spinner} />
                  : <span style={{ fontSize: '1rem', lineHeight: 1 }}>↑</span>
                }
              </button>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    padding: '1.5rem 2rem 3rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#212529',
  },
  backLink: {
    display: 'inline-block',
    marginBottom: '1.25rem',
    color: '#1a1a2e',
    textDecoration: 'none',
    fontSize: '0.875rem',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '300px 1fr',
    gap: '1.25rem',
    alignItems: 'start',
    maxWidth: '1180px',
    margin: '0 auto',
  },
  aside: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  card: {
    background: 'white',
    borderRadius: '10px',
    padding: '1.25rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  avatar: {
    width: '68px', height: '68px',
    borderRadius: '50%',
    background: '#1a1a2e',
    color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.375rem',
    fontWeight: '700',
    marginBottom: '0.25rem',
    flexShrink: 0,
  },
  name: {
    fontSize: '1.125rem',
    fontWeight: '700',
    color: '#1a1a2e',
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.3,
  },
  roleText: {
    color: '#6c757d',
    fontSize: '0.875rem',
    textAlign: 'center',
    margin: 0,
  },
  badge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  jobChip: {
    display: 'inline-block',
    marginTop: '0.25rem',
    padding: '4px 12px',
    borderRadius: '20px',
    background: '#f0f2f5',
    color: '#1a1a2e',
    fontSize: '0.75rem',
    textDecoration: 'none',
    border: '1px solid #dee2e6',
  },
  sectionTitle: {
    fontWeight: '600',
    fontSize: '0.875rem',
    color: '#1a1a2e',
  },
  rescoreBtn: {
    background: 'white',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    color: '#6c757d',
    fontSize: '0.75rem',
    padding: '3px 8px',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  reasoning: {
    color: '#6c757d',
    fontSize: '0.8125rem',
    textAlign: 'center',
    lineHeight: 1.5,
    margin: '0.25rem 0 0',
    alignSelf: 'stretch',
  },
  scoreDate: {
    color: '#adb5bd',
    fontSize: '0.6875rem',
    textAlign: 'center',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0',
    borderBottom: '1px solid #f8f9fa',
    gap: '0.5rem',
  },
  statLabel: {
    fontSize: '0.8125rem',
    color: '#6c757d',
    flexShrink: 0,
  },
  statValue: {
    fontSize: '0.8125rem',
    color: '#212529',
    fontWeight: '500',
    textAlign: 'right',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '170px',
  },
  inlineLink: {
    color: '#1a1a2e',
    fontSize: '0.8125rem',
    textDecoration: 'none',
    fontWeight: '500',
  },
  skillPill: {
    padding: '0.25rem 0.75rem',
    background: '#e9ecef',
    borderRadius: '12px',
    fontSize: '0.75rem',
    color: '#495057',
  },
  outreachBtn: {
    width: '100%',
    padding: '0.875rem',
    background: '#1a1a2e',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: '600',
    letterSpacing: '0.02em',
    boxShadow: '0 2px 8px rgba(26,26,46,0.2)',
    transition: 'background 0.15s, box-shadow 0.15s',
  },
  /* Chat */
  chatPanel: {
    background: 'white',
    borderRadius: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 130px)',
    minHeight: '600px',
    overflow: 'hidden',
  },
  chatHeader: {
    padding: '1.125rem 1.5rem',
    borderBottom: '1px solid #f0f2f5',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  chatTitle: {
    fontWeight: '700',
    fontSize: '0.9375rem',
    color: '#1a1a2e',
    margin: 0,
  },
  chatSub: {
    color: '#adb5bd',
    fontSize: '0.75rem',
    margin: '2px 0 0',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.25rem 1.5rem',
    background: '#fafbfc',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingTop: '3rem',
    textAlign: 'center',
  },
  quickBar: {
    padding: '0.625rem 1.5rem',
    borderTop: '1px solid #f0f2f5',
    background: '#f8f9fa',
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    flexShrink: 0,
  },
  quickLabel: {
    fontSize: '0.75rem',
    color: '#adb5bd',
    flexShrink: 0,
    fontWeight: '500',
  },
  chip: {
    padding: '4px 12px',
    background: 'white',
    border: '1px solid #dee2e6',
    borderRadius: '20px',
    color: '#6c757d',
    fontSize: '0.75rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
  },
  inputRow: {
    padding: '1rem 1.5rem',
    borderTop: '1px solid #f0f2f5',
    background: 'white',
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    background: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '10px',
    color: '#212529',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    resize: 'none',
    lineHeight: '1.5',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  sendBtn: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    background: '#1a1a2e',
    border: 'none',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.15s, opacity 0.15s',
  },
  spinner: {
    width: '15px', height: '15px',
    border: '2px solid rgba(255,255,255,0.25)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
  },
};