import axios from 'axios';

const SERPER_API_KEY = process.env.SERPER_API_KEY;

export async function searchCandidates(query, limit = 10) {
  if (!SERPER_API_KEY) {
    // Return mock data if no API key
    return generateMockCandidates(query, limit);
  }

  try {
    const response = await axios.post(
      'https://google.serper.dev/search',
      {
        q: `${query} site:linkedin.com/in`,
        num: limit
      },
      {
        headers: {
          'X-API-Key': SERPER_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const results = response.data.organic || [];
    return results.map(result => ({
      name: extractNameFromTitle(result.title),
      linkedinUrl: extractLinkedInUrl(result.link) || result.link,
      currentRole: result.title,
      snippet: result.snippet,
      sourcedFrom: 'serper'
    }));
  } catch (error) {
    console.error('Serper API error:', error.message);
    return generateMockCandidates(query, limit);
  }
}

function extractNameFromTitle(title) {
  // Try to extract name from LinkedIn title like "John Doe - Software Engineer"
  const match = title.match(/^([^-]+)/);
  return match ? match[1].trim() : 'Unknown Candidate';
}

function extractLinkedInUrl(url) {
  if (url && url.includes('linkedin.com')) {
    return url;
  }
  return null;
}

function generateMockCandidates(query, limit) {
  const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery'];
  const lastNames = ['Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Martinez'];
  const roles = ['Software Engineer', 'Full Stack Developer', 'Node.js Developer', 'React Developer'];
  const companies = ['Google', 'Meta', 'Amazon', 'Netflix', 'Stripe', 'Airbnb'];

  const candidates = [];
  for (let i = 0; i < limit; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const role = roles[Math.floor(Math.random() * roles.length)];
    const company = companies[Math.floor(Math.random() * companies.length)];

    candidates.push({
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
      linkedinUrl: `https://linkedin.com/in/${firstName.toLowerCase()}${lastName.toLowerCase()}${i}`,
      currentRole: `${role} at ${company}`,
      experience: `${Math.floor(Math.random() * 10) + 1} years`,
      skills: [role, 'JavaScript', 'React', 'Node.js', 'MongoDB'].slice(0, Math.floor(Math.random() * 5) + 2),
      location: ['San Francisco, CA', 'New York, NY', 'Austin, TX', 'Remote'][Math.floor(Math.random() * 4)],
      sourcedFrom: 'mock'
    });
  }

  return candidates;
}