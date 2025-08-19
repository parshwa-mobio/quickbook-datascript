const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db"); // pg connection

const app = express();
app.use(bodyParser.json());

app.post("/terms", async (req, res) => {
  const client = await pool.connect();
  try {
    const { QueryResponse } = req.body;
    const terms = QueryResponse?.Term || [];

    await client.query("BEGIN");

    for (const term of terms) {
      await client.query(
        `INSERT INTO terms (
          id, name, active, type, due_days, discount_days,
          domain, sparse, sync_token, create_time, last_updated_time
        ) VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,$11
        )
        ON CONFLICT (id) DO NOTHING`,
        [
          term.Id,
          term.Name || null,
          term.Active || false,
          term.Type || null,
          term.DueDays || null,
          term.DiscountDays || null,
          term.domain || null,
          term.sparse || null,
          term.SyncToken || null,
          term.MetaData?.CreateTime || null,
          term.MetaData?.LastUpdatedTime || null
        ]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Terms saved successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving terms:", error);
    res.status(500).json({ error: "Failed to save terms" });
  } finally {
    client.release();
  }
});

app.listen(5000, () => {
  console.log("Terms service running on port 5000");
});
