import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useTaskStream } from '../hooks/useTaskStream';
import { useToast } from '../components/Toast';

function JobDetails() {
  const { id } = useParams();
  const { toast, updateToast } = useToast();

  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sourcing, setSourcing] = useState(false);
  const [sourcingQuery, setSourcingQuery] = useState('');

  // Track the active sourcing task so we can stream its updates
  const [sourcingTaskId, setSourcingTaskId] = useState(null);
  const [sourcingToastId, setSourcingToastId] = useState(null);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [jobRes, candidatesRes] = await Promise.all([
        api.getJob(id),
        api.getCandidatesForJob(id)
      ]);
      setJob(jobRes.data.data);
      setCandidates(candidatesRes.data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── SSE subscription for the active sourcing task ──────────────────────────
  useTaskStream(sourcingTaskId, {
    onUpdate: (data) => {
      if (sourcingToastId) {
        updateToast(sourcingToastId, {
          message: `Searching for candidates… ${data.progress ?? 0}%`,
          progress: data.progress ?? 0,
        });
      }
    },
    onComplete: (data) => {
      const { found = 0, saved = 0 } = data.result ?? {};
      if (sourcingToastId) {
        updateToast(sourcingToastId, {
          type: 'success',
          title: 'Sourcing complete',
          message: `Found ${found} candidates, ${saved} new profiles saved.`,
          progress: 100,
        });
      }
      setSourcingTaskId(null);
      // Refresh candidates list automatically
      loadData();
    },
    onError: (data) => {
      if (sourcingToastId) {
        updateToast(sourcingToastId, {
          type: 'error',
          title: 'Sourcing failed',
          message: data.error ?? 'An unknown error occurred.',
          progress: undefined,
        });
      }
      setSourcingTaskId(null);
    },
  });

  const handleSourcing = async () => {
    try {
      setSourcing(true);
      const res = await api.triggerSourcing(id, { query: sourcingQuery, limit: 10 });
      const taskId = res.data.data.taskId;

      // Show a loading toast immediately
      const tid = toast({
        type: 'loading',
        title: 'Sourcing started',
        message: 'Searching for candidates… 0%',
        progress: 0,
      });

      setSourcingQuery('');
      setSourcingTaskId(taskId);
      setSourcingToastId(tid);
    } catch (err) {
      toast({ type: 'error', title: 'Error', message: err.message });
      setError(err.message);
    } finally {
      setSourcing(false);
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
  if (!job) return <div>Job not found</div>;

  return (
    <div>
      <Link to="/" style={styles.backLink}>← Back to Jobs</Link>

      <div style={styles.header}>
        <div>
          <h1>{job.title}</h1>
          <p style={styles.info}>{job.location} • {job.employmentType}</p>
          <span style={{
            ...styles.status,
            background: job.status === 'open' ? '#d4edda' : '#f8d7da',
            color: job.status === 'open' ? '#155724' : '#721c24'
          }}>
            {job.status}
          </span>
        </div>
      </div>

      <div style={styles.section}>
        <h2>Job Description</h2>
        <p style={styles.description}>{job.description}</p>
        {job.requirements?.length > 0 && (
          <div style={styles.requirements}>
            <h3>Requirements:</h3>
            <ul>
              {job.requirements.map((req, i) => <li key={i}>{req}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div style={styles.section}>
        <h2>Source Candidates</h2>
        <div style={styles.sourcingForm}>
          <input
            type="text"
            placeholder="Search query (e.g., Node.js Developer)"
            value={sourcingQuery}
            onChange={(e) => setSourcingQuery(e.target.value)}
            style={styles.input}
          />
          <button
            onClick={handleSourcing}
            disabled={sourcing || !!sourcingTaskId}
            style={{
              ...styles.button,
              opacity: (sourcing || !!sourcingTaskId) ? 0.6 : 1,
              cursor: (sourcing || !!sourcingTaskId) ? 'not-allowed' : 'pointer'
            }}
          >
            {sourcing ? 'Starting…' : sourcingTaskId ? 'Sourcing…' : 'Source Candidates'}
          </button>
        </div>
        {sourcingTaskId && (
          <p style={styles.hint}>⚡ Live updates active — candidates will appear automatically when ready.</p>
        )}
      </div>

      <div style={styles.section}>
        <h2>Candidates ({candidates.length})</h2>
        {candidates.length === 0 ? (
          <p style={styles.empty}>No candidates yet. Source some to get started.</p>
        ) : (
          <div style={styles.candidateList}>
            {candidates.map(candidate => (
              <Link
                to={`/candidates/${candidate._id}`}
                key={candidate._id}
                style={styles.candidateCard}
              >
                <div style={styles.candidateInfo}>
                  <h3>{candidate.name}</h3>
                  <p>{candidate.currentRole}</p>
                  <p style={styles.small}>{candidate.location}</p>
                </div>
                {candidate.score?.value !== undefined && (
                  <div style={{ ...styles.score, background: getScoreColor(candidate.score) }}>
                    {candidate.score.value}
                  </div>
                )}
                <span style={{
                  ...styles.statusBadge,
                  background: candidate.status === 'interested' ? '#d4edda' : '#e2e3e5',
                  color: candidate.status === 'interested' ? '#155724' : '#383d41'
                }}>
                  {candidate.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  loading: { padding: '2rem', textAlign: 'center', color: '#666' },
  error: { padding: '1rem', background: '#f8d7da', color: '#721c24', borderRadius: '4px', marginBottom: '1rem' },
  backLink: { display: 'inline-block', marginBottom: '1rem', color: '#1a1a2e', textDecoration: 'none' },
  header: { marginBottom: '2rem' },
  info: { color: '#666', marginBottom: '0.5rem' },
  status: { display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.875rem' },
  section: { background: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  description: { marginBottom: '1rem', lineHeight: 1.6 },
  requirements: { marginTop: '1rem', paddingLeft: '1.5rem' },
  sourcingForm: { display: 'flex', gap: '1rem', marginTop: '1rem' },
  input: { flex: 1, padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' },
  button: { padding: '0.75rem 1.5rem', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  hint: { marginTop: '0.75rem', fontSize: '0.8125rem', color: '#6366f1' },
  candidateList: { display: 'grid', gap: '1rem', marginTop: '1rem' },
  candidateCard: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', textDecoration: 'none', color: 'inherit' },
  candidateInfo: { flex: 1 },
  small: { fontSize: '0.875rem', color: '#666' },
  score: { width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' },
  statusBadge: { padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' },
  empty: { textAlign: 'center', color: '#666', padding: '2rem' }
};

export default JobDetails;