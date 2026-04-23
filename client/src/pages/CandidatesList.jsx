import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

function CandidatesList() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCandidates();
  }, []);

  const loadCandidates = async () => {
    try {
      setLoading(true);
      const res = await api.getCandidates();
      setCandidates(res.data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (!score || !score.value) return '#ccc';
    if (score.value >= 80) return '#28a745';
    if (score.value >= 60) return '#ffc107';
    return '#dc3545';
  };

  const getStatusColor = (status) => {
    const colors = {
      sourced: '#17a2b8',
      scored: '#6c757d',
      contacted: '#ffc107',
      interested: '#28a745',
      not_interested: '#dc3545',
      scheduled: '#007bff'
    };
    return colors[status] || '#6c757d';
  };

  if (loading) return <div style={styles.loading}>Loading candidates...</div>;
  if (error) return <div style={styles.error}>Error: {error}</div>;

  return (
    <div>
      <h1 style={styles.title}>All Candidates</h1>

      {candidates.length === 0 ? (
        <div style={styles.empty}>
          <p>No candidates yet.</p>
          <Link to="/" style={styles.link}>Go to Jobs to source candidates</Link>
        </div>
      ) : (
        <div style={styles.grid}>
          {candidates.map(candidate => (
            <Link
              to={`/candidates/${candidate._id}`}
              key={candidate._id}
              style={styles.card}
            >
              <div style={styles.header}>
                <h3>{candidate.name}</h3>
                {candidate.score?.value !== undefined && (
                  <div style={{
                    ...styles.score,
                    background: getScoreColor(candidate.score)
                  }}>
                    {candidate.score.value}
                  </div>
                )}
              </div>
              <p style={styles.role}>{candidate.currentRole}</p>
              {candidate.jobId && (
                <p style={styles.job}>Job: {candidate.jobId.title}</p>
              )}
              <div style={styles.footer}>
                <span style={{
                  ...styles.status,
                  background: getStatusColor(candidate.status),
                  color: 'white'
                }}>
                  {candidate.status}
                </span>
                <span style={styles.source}>{candidate.sourcedFrom}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  loading: { padding: '2rem', textAlign: 'center', color: '#666' },
  error: { padding: '1rem', background: '#f8d7da', color: '#721c24', borderRadius: '4px' },
  title: { marginBottom: '2rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' },
  card: { display: 'block', background: 'white', padding: '1.5rem', borderRadius: '8px', textDecoration: 'none', color: 'inherit', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' },
  role: { color: '#666', marginBottom: '0.5rem' },
  job: { fontSize: '0.875rem', color: '#888', marginBottom: '1rem' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  status: { padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' },
  source: { fontSize: '0.75rem', color: '#888' },
  score: { width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.875rem' },
  empty: { textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '8px' },
  link: { display: 'inline-block', marginTop: '1rem', color: '#1a1a2e' }
};

export default CandidatesList;