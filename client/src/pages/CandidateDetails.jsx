import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useTaskStream } from '../hooks/useTaskStream';
import { useToast } from '../components/Toast';

function CandidateDetails() {
  const { id } = useParams();
  const { toast, updateToast } = useToast();

  const [candidate, setCandidate] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);

  // Active task tracking
  const [scoringTaskId, setScoringTaskId] = useState(null);
  const [scoringToastId, setScoringToastId] = useState(null);
  const [outreachTaskId, setOutreachTaskId] = useState(null);
  const [outreachToastId, setOutreachToastId] = useState(null);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [candidateRes, messagesRes] = await Promise.all([
        api.getCandidate(id),
        api.getCandidateMessages(id)
      ]);
      setCandidate(candidateRes.data.data);
      setMessages(messagesRes.data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Scoring SSE ─────────────────────────────────────────────────────────────
  useTaskStream(scoringTaskId, {
    onUpdate: (data) => {
      if (scoringToastId) {
        updateToast(scoringToastId, {
          message: `Analysing candidate profile… ${data.progress ?? 0}%`,
          progress: data.progress ?? 0,
        });
      }
    },
    onComplete: (data) => {
      const score = data.result;
      if (scoringToastId) {
        updateToast(scoringToastId, {
          type: 'success',
          title: 'Scoring complete',
          message: score?.value !== undefined
            ? `Score: ${score.value}/100 — ${score.reasoning ?? ''}`
            : 'Candidate has been scored.',
          progress: 100,
        });
      }
      setScoringTaskId(null);
      loadData(); // Refresh to show new score
    },
    onError: (data) => {
      if (scoringToastId) {
        updateToast(scoringToastId, {
          type: 'error',
          title: 'Scoring failed',
          message: data.error ?? 'An unknown error occurred.',
          progress: undefined,
        });
      }
      setScoringTaskId(null);
    },
  });

  // ── Outreach SSE ─────────────────────────────────────────────────────────────
  useTaskStream(outreachTaskId, {
    onUpdate: (data) => {
      if (outreachToastId) {
        updateToast(outreachToastId, {
          message: `Generating personalised message… ${data.progress ?? 0}%`,
          progress: data.progress ?? 0,
        });
      }
    },
    onComplete: (data) => {
      if (outreachToastId) {
        updateToast(outreachToastId, {
          type: 'success',
          title: 'Outreach sent',
          message: 'Personalised message delivered to the candidate.',
          progress: 100,
        });
      }
      setOutreachTaskId(null);
      loadData();
    },
    onError: (data) => {
      if (outreachToastId) {
        updateToast(outreachToastId, {
          type: 'error',
          title: 'Outreach failed',
          message: data.error ?? 'An unknown error occurred.',
          progress: undefined,
        });
      }
      setOutreachTaskId(null);
    },
  });

  const handleScore = async () => {
    try {
      const res = await api.scoreCandidate(id);
      const taskId = res.data.data?.taskId;

      // Cached result — no task created
      if (!taskId) {
        toast({ type: 'info', title: 'Score ready', message: 'Loaded from cache.' });
        loadData();
        return;
      }

      const tid = toast({
        type: 'loading',
        title: 'Scoring candidate',
        message: 'Analysing candidate profile… 0%',
        progress: 0,
      });
      setScoringTaskId(taskId);
      setScoringToastId(tid);
    } catch (err) {
      toast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleOutreach = async () => {
    if (!candidate?.jobId) {
      toast({ type: 'error', title: 'No job linked', message: 'This candidate is not associated with a job.' });
      return;
    }
    try {
      const res = await api.outreachCandidate(id, candidate.jobId._id);
      const taskId = res.data.data?.taskId;

      const tid = toast({
        type: 'loading',
        title: 'Sending outreach',
        message: 'Generating personalised message… 0%',
        progress: 0,
      });
      setOutreachTaskId(taskId);
      setOutreachToastId(tid);
    } catch (err) {
      toast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleResponse = async (e) => {
    e.preventDefault();
    if (!responseMessage.trim()) return;
    try {
      setSendingResponse(true);
      await api.respondToCandidate(id, responseMessage);
      setResponseMessage('');
      loadData();
    } catch (err) {
      toast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setSendingResponse(false);
    }
  };

  const getScoreColor = (score) => {
    if (!score?.value) return '#ccc';
    if (score.value >= 80) return '#28a745';
    if (score.value >= 60) return '#ffc107';
    return '#dc3545';
  };

  if (loading) return <div style={styles.loading}>Loading...</div>;
  if (error) return <div style={styles.error}>Error: {error}</div>;
  if (!candidate) return <div>Candidate not found</div>;

  const scoringActive = !!scoringTaskId;
  const outreachActive = !!outreachTaskId;

  return (
    <div>
      <Link to="/candidates" style={styles.backLink}>← Back to Candidates</Link>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h1>{candidate.name}</h1>
          <p style={styles.role}>{candidate.currentRole}</p>
          <span style={styles.status}>{candidate.status}</span>

          <div style={styles.section}>
            <h3>Profile</h3>
            <p><strong>Location:</strong> {candidate.location}</p>
            <p><strong>Experience:</strong> {candidate.experience}</p>
            <p><strong>Email:</strong> {candidate.email || 'N/A'}</p>
            <p><strong>LinkedIn:</strong> {candidate.linkedinUrl ? (
              <a href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer">View Profile</a>
            ) : 'N/A'}</p>
            {candidate.skills?.length > 0 && (
              <div style={styles.skills}>
                {candidate.skills.map((skill, i) => (
                  <span key={i} style={styles.skill}>{skill}</span>
                ))}
              </div>
            )}
          </div>

          {candidate.jobId && (
            <div style={styles.section}>
              <h3>Applied For</h3>
              <Link to={`/jobs/${candidate.jobId._id}`} style={styles.jobLink}>
                {candidate.jobId.title}
              </Link>
            </div>
          )}

          <div style={styles.actions}>
            <button
              onClick={handleScore}
              disabled={scoringActive}
              style={{ ...styles.button, opacity: scoringActive ? 0.6 : 1, cursor: scoringActive ? 'not-allowed' : 'pointer' }}
            >
              {scoringActive ? 'Scoring…' : 'AI Score Candidate'}
            </button>
            <button
              onClick={handleOutreach}
              disabled={outreachActive}
              style={{ ...styles.primaryButton, opacity: outreachActive ? 0.6 : 1, cursor: outreachActive ? 'not-allowed' : 'pointer' }}
            >
              {outreachActive ? 'Sending…' : 'Send Outreach'}
            </button>
          </div>
        </div>

        <div style={styles.card}>
          {candidate.score?.value !== undefined && (
            <div style={styles.scoreSection}>
              <div style={{ ...styles.scoreCircle, borderColor: getScoreColor(candidate.score) }}>
                <span style={{ color: getScoreColor(candidate.score) }}>
                  {candidate.score.value}
                </span>
              </div>
              <p style={styles.reasoning}>{candidate.score.reasoning}</p>
              {candidate.score.scoredAt && (
                <p style={styles.scoreDate}>
                  Scored: {new Date(candidate.score.scoredAt).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          <h3>Messages</h3>
          <div style={styles.messages}>
            {messages.length === 0 ? (
              <p style={styles.empty}>No messages yet</p>
            ) : (
              messages.map(msg => (
                <div
                  key={msg._id}
                  style={{
                    ...styles.message,
                    background: msg.direction === 'outbound' ? '#e3f2fd' : '#f5f5f5',
                    marginLeft: msg.direction === 'outbound' ? '2rem' : '0',
                    marginRight: msg.direction === 'inbound' ? '2rem' : '0'
                  }}
                >
                  <div style={styles.messageHeader}>
                    <span style={styles.messageDir}>
                      {msg.direction === 'outbound' ? '→ Sent' : '← Received'}
                    </span>
                    <span style={styles.messageTime}>
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p style={styles.messageContent}>{msg.content}</p>
                  {msg.intent && (
                    <span style={{
                      ...styles.intent,
                      background: msg.intent === 'interested' ? '#d4edda' : msg.intent === 'not_interested' ? '#f8d7da' : '#fff3cd'
                    }}>
                      Intent: {msg.intent}
                    </span>
                  )}
                  {msg.scheduledLink && (
                    <p style={styles.scheduledLink}>
                      📅 <a href={msg.scheduledLink} target="_blank" rel="noopener noreferrer">Scheduling Link</a>
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleResponse} style={styles.responseForm}>
            <h3>Simulate Candidate Response</h3>
            <textarea
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              placeholder="Enter candidate response (e.g., 'Yes, I'm interested!')"
              rows={3}
              style={styles.textarea}
            />
            <button
              type="submit"
              disabled={sendingResponse || !responseMessage.trim()}
              style={styles.button}
            >
              {sendingResponse ? 'Processing…' : 'Simulate Response'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  loading: { padding: '2rem', textAlign: 'center', color: '#666' },
  error: { padding: '1rem', background: '#f8d7da', color: '#721c24', borderRadius: '4px', marginBottom: '1rem' },
  backLink: { display: 'inline-block', marginBottom: '1rem', color: '#1a1a2e', textDecoration: 'none' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' },
  card: { background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  role: { color: '#666', fontSize: '1.1rem', marginBottom: '0.5rem' },
  status: { display: 'inline-block', padding: '0.25rem 0.75rem', background: '#e2e3e5', borderRadius: '12px', fontSize: '0.875rem' },
  section: { marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #eee' },
  skills: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' },
  skill: { padding: '0.25rem 0.75rem', background: '#e9ecef', borderRadius: '12px', fontSize: '0.875rem' },
  jobLink: { color: '#1a1a2e' },
  actions: { marginTop: '1.5rem', display: 'flex', gap: '1rem' },
  button: { padding: '0.75rem 1.5rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  primaryButton: { padding: '0.75rem 1.5rem', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  scoreSection: { textAlign: 'center', marginBottom: '1.5rem' },
  scoreCircle: { width: '80px', height: '80px', borderRadius: '50%', border: '4px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.5rem', fontWeight: 'bold' },
  reasoning: { color: '#666', fontSize: '0.9rem' },
  scoreDate: { fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' },
  messages: { marginTop: '1rem', maxHeight: '300px', overflowY: 'auto' },
  message: { padding: '1rem', borderRadius: '8px', marginBottom: '0.5rem' },
  messageHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.75rem' },
  messageDir: { fontWeight: 'bold' },
  messageTime: { color: '#999' },
  messageContent: { fontSize: '0.9rem' },
  intent: { display: 'inline-block', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', marginTop: '0.5rem' },
  scheduledLink: { marginTop: '0.5rem', fontSize: '0.875rem' },
  responseForm: { marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #eee' },
  textarea: { width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', margin: '0.5rem 0', resize: 'vertical' },
  empty: { color: '#999', textAlign: 'center', padding: '1rem' }
};

export default CandidateDetails;