import axios from 'axios';

const API_BASE = '/api';

export const api = {
  // Jobs
  getJobs: () => axios.get(`${API_BASE}/jobs`),
  getJob: (id) => axios.get(`${API_BASE}/jobs/${id}`),
  createJob: (data) => axios.post(`${API_BASE}/jobs`, data),
  triggerSourcing: (jobId, data) => axios.post(`${API_BASE}/jobs/${jobId}/sourcing-tasks`, data),
  getCandidatesForJob: (jobId) => axios.get(`${API_BASE}/jobs/${jobId}/candidates`),

  // Candidates
  getCandidates: () => axios.get(`${API_BASE}/candidates`),
  getCandidate: (id) => axios.get(`${API_BASE}/candidates/${id}`),
  scoreCandidate: (id) => axios.post(`${API_BASE}/candidates/${id}/scores`),
  outreachCandidate: (id, jobId) => axios.post(`${API_BASE}/candidates/${id}/outreach`, { jobId }),
  respondToCandidate: (id, message) => axios.post(`${API_BASE}/candidates/${id}/responses`, { message }),
  getCandidateMessages: (id) => axios.get(`${API_BASE}/candidates/${id}/messages`),

  // Tasks
  getTask: (taskId) => axios.get(`${API_BASE}/tasks/${taskId}`)
};