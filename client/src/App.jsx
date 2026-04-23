import { Routes, Route, Link } from 'react-router-dom';
import JobsList from './pages/JobsList';
import JobDetails from './pages/JobDetails';
import CandidatesList from './pages/CandidatesList';
import CandidateDetails from './pages/CandidateDetails';

function App() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <nav style={{
        background: '#1a1a2e',
        padding: '1rem 2rem',
        display: 'flex',
        gap: '2rem',
        alignItems: 'center'
      }}>
        <Link to="/" style={{
          color: 'white',
          textDecoration: 'none',
          fontSize: '1.25rem',
          fontWeight: 'bold'
        }}>
          Recruit Automation
        </Link>
        <Link to="/" style={{ color: '#a0a0a0', textDecoration: 'none' }}>Jobs</Link>
        <Link to="/candidates" style={{ color: '#a0a0a0', textDecoration: 'none' }}>Candidates</Link>
      </nav>

      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <Routes>
          <Route path="/" element={<JobsList />} />
          <Route path="/jobs/:id" element={<JobDetails />} />
          <Route path="/candidates" element={<CandidatesList />} />
          <Route path="/candidates/:id" element={<CandidateDetails />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;