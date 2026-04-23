import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

function JobsList() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: '',
    location: 'Remote',
    employmentType: 'full-time'
  });

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const res = await api.getJobs();
      setJobs(res.data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        requirements: formData.requirements.split(',').map(r => r.trim()).filter(Boolean)
      };
      await api.createJob(data);
      setShowForm(false);
      setFormData({
        title: '',
        description: '',
        requirements: '',
        location: 'Remote',
        employmentType: 'full-time'
      });
      loadJobs();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div style={styles.loading}>Loading jobs...</div>;
  if (error) return <div style={styles.error}>Error: {error}</div>;

  return (
    <div>
      <div style={styles.header}>
        <h1>Jobs</h1>
        <button onClick={() => setShowForm(!showForm)} style={styles.button}>
          {showForm ? 'Cancel' : 'Create Job'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            placeholder="Job Title"
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            required
            style={styles.input}
          />
          <textarea
            placeholder="Job Description"
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            required
            rows={4}
            style={styles.textarea}
          />
          <input
            type="text"
            placeholder="Requirements (comma separated)"
            value={formData.requirements}
            onChange={e => setFormData({ ...formData, requirements: e.target.value })}
            style={styles.input}
          />
          <input
            type="text"
            placeholder="Location"
            value={formData.location}
            onChange={e => setFormData({ ...formData, location: e.target.value })}
            style={styles.input}
          />
          <select
            value={formData.employmentType}
            onChange={e => setFormData({ ...formData, employmentType: e.target.value })}
            style={styles.select}
          >
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>
          <button type="submit" style={styles.primaryButton}>Create Job</button>
        </form>
      )}

      <div style={styles.jobList}>
        {jobs.map(job => (
          <Link to={`/jobs/${job._id}`} key={job._id} style={styles.jobCard}>
            <h3 style={styles.jobTitle}>{job.title}</h3>
            <p style={styles.jobInfo}>{job.location} • {job.employmentType}</p>
            <span style={{
              ...styles.status,
              background: job.status === 'open' ? '#d4edda' : '#f8d7da',
              color: job.status === 'open' ? '#155724' : '#721c24'
            }}>
              {job.status}
            </span>
          </Link>
        ))}
        {jobs.length === 0 && <p style={styles.empty}>No jobs yet. Create one to get started.</p>}
      </div>
    </div>
  );
}

const styles = {
  loading: { padding: '2rem', textAlign: 'center', color: '#666' },
  error: { padding: '1rem', background: '#f8d7da', color: '#721c24', borderRadius: '4px', marginBottom: '1rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
  button: { padding: '0.75rem 1.5rem', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  form: { background: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
  input: { padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '1rem' },
  textarea: { padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '1rem', resize: 'vertical' },
  select: { padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '1rem' },
  primaryButton: { padding: '0.75rem 1.5rem', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' },
  jobList: { display: 'grid', gap: '1rem' },
  jobCard: { display: 'block', background: 'white', padding: '1.5rem', borderRadius: '8px', textDecoration: 'none', color: 'inherit', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  jobTitle: { marginBottom: '0.5rem' },
  jobInfo: { color: '#666', marginBottom: '0.5rem' },
  status: { display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.875rem' },
  empty: { textAlign: 'center', color: '#666', padding: '2rem' }
};

export default JobsList;