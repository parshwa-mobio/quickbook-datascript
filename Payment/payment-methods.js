const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post("/save-payment-methods", async (req, res) => {
  const paymentMethods = req.body;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const method of paymentMethods) {
      await client.query(
        `
        INSERT INTO payment_methods (
          qb_id,
          name,
          active,
          type,
          domain,
          sparse,
          sync_token,
          metadata_create_time,
          metadata_last_updated_time
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (qb_id) DO UPDATE SET
          name = EXCLUDED.name,
          active = EXCLUDED.active,
          type = EXCLUDED.type,
          domain = EXCLUDED.domain,
          sparse = EXCLUDED.sparse,
          sync_token = EXCLUDED.sync_token,
          metadata_create_time = EXCLUDED.metadata_create_time,
          metadata_last_updated_time = EXCLUDED.metadata_last_updated_time
        `,
        [
          method.Id || null,
          method.Name || null,
          method.Active ?? null,
          method.Type || null,
          method.domain || null,
          method.sparse ?? null,
          method.SyncToken || null,
          method.MetaData?.CreateTime || null,
          method.MetaData?.LastUpdatedTime || null
        ]
      );
    }

    await client.query("COMMIT");
    res.status(200).json({ message: "Payment methods saved successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving payment methods:", error);
    res.status(500).json({ error: "Failed to save payment methods" });
  } finally {
    client.release();
  }
});


app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
