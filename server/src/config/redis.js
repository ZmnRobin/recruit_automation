import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

// For BullMQ job queue
export const createRedisClient = () => {
  return new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: null,
  });
};

// For caching
export const cacheClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
});

export default cacheClient;