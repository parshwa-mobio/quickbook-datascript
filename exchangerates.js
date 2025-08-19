const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
app.use(bodyParser.json());

app.post("/save-exchange-rates", async (req, res) => {
  const exchangeData = req.body;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const rate of exchangeData) {
      await client.query(
        `
        INSERT INTO exchange_rates (
          source_currency_code,
          target_currency_code,
          rate,
          as_of_date,
          metadata_last_updated_time
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (source_currency_code, target_currency_code, as_of_date) DO NOTHING
        `,
        [
          rate.SourceCurrencyCode || null,
          rate.TargetCurrencyCode || null,
          rate.Rate || null,
          rate.AsOfDate || null,
          rate.MetaData?.LastUpdatedTime || null,
        ]
      );
    }

    await client.query("COMMIT");
    res.status(200).json({ message: "Exchange rates saved successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving exchange rates:", error);
    res.status(500).json({ error: "Failed to save exchange rates" });
  } finally {
    client.release();
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
