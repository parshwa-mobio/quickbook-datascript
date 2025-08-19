const { Pool } = require("pg");

// PostgreSQL connection
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "cpa-quickbook-localdata",
  password: "parshwa@1234",
  port: 5432,
});

module.exports = pool;
