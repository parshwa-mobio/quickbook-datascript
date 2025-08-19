const { Pool } = require("pg");

// PostgreSQL connection
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "quickbook",
  password: "kp-mobio",
  port: 5432,
});

module.exports = pool;
