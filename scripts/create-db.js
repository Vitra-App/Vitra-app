const { Client } = require('pg');
const c = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: null,
  database: 'postgres',
});
c.connect()
  .then(() => c.query('CREATE DATABASE nutriai'))
  .then(() => { console.log('Database created'); c.end(); })
  .catch((e) => {
    if (e.code === '42P04') { console.log('Database already exists - OK'); }
    else { console.error('Error:', e.message, 'code:', e.code); }
    c.end();
  });
