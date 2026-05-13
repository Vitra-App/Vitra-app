const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Step 1: get CSRF token + cookie
  const csrf = await request({ host: 'localhost', port: 3001, path: '/api/auth/csrf', method: 'GET' });
  const csrfToken = JSON.parse(csrf.body).csrfToken;
  const cookies = csrf.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ') || '';
  console.log('CSRF token:', csrfToken);
  console.log('Cookies:', cookies);

  // Step 2: POST login
  const body = new URLSearchParams({
    email: 'demo@vitra.app',
    password: 'demo1234',
    csrfToken,
    callbackUrl: 'http://localhost:3001/',
    json: 'true',
  }).toString();

  const login = await request({
    host: 'localhost', port: 3001,
    path: '/api/auth/callback/credentials',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      'Cookie': cookies,
      'Origin': 'http://localhost:3001',
    },
  }, body);

  console.log('Login status:', login.status);
  console.log('Login response:', login.body.substring(0, 500));
}

main().catch(console.error);
