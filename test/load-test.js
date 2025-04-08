import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 10 }, // Stay at 10 users
    { duration: '1m', target: 20 }, // Ramp up to 20 users
    { duration: '3m', target: 20 }, // Stay at 20 users
    { duration: '1m', target: 50 }, // Ramp up to 50 users
    { duration: '3m', target: 50 }, // Stay at 50 users
    { duration: '1m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'], // Less than 1% of requests should fail
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://comprehendo.fly.dev';

export default function () {
  // Test homepage access
  const homeResponse = http.get(`${BASE_URL}/en`);
  check(homeResponse, {
    'homepage status is 200': (r) => r.status === 200,
  });

  // Test content generation
  const generateResponse = http.post(
    `${BASE_URL}/api/generate`,
    JSON.stringify({
      language: 'en',
      level: 'A1',
      topic: 'travel',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  check(generateResponse, {
    'generate status is 200': (r) => r.status === 200,
  });

  // Test user progress updates
  const progressResponse = http.post(
    `${BASE_URL}/api/progress`,
    JSON.stringify({
      userId: randomString(10),
      exerciseId: randomString(10),
      score: Math.floor(Math.random() * 100),
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  check(progressResponse, {
    'progress status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
