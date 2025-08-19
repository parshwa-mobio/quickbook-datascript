const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post("/save-aged-payables", async (req, res) => {
  const report = req.body;
  const rows = report.Rows.Row;

  const client = await pool.connect();
  try {
    for (let row of rows) {
      if (row.Summary) continue; // skip summary row

      const colData = row.ColData;
      const vendor = colData[0];
      
      await client.query(
        `INSERT INTO aged_payables (
            vendor_id, vendor_name, amt_current, amt_1_30, amt_31_60, amt_61_90, amt_91_over, total_amt, report_time, report_date
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
        )
        ON CONFLICT (vendor_id) DO UPDATE
        SET vendor_name = EXCLUDED.vendor_name,
            amt_current = EXCLUDED.amt_current,
            amt_1_30 = EXCLUDED.amt_1_30,
            amt_31_60 = EXCLUDED.amt_31_60,
            amt_61_90 = EXCLUDED.amt_61_90,
            amt_91_over = EXCLUDED.amt_91_over,
            total_amt = EXCLUDED.total_amt,
            report_time = EXCLUDED.report_time,
            report_date = EXCLUDED.report_date`,
        [
          vendor.id || null,
          vendor.value || null,
          parseFloat(colData[1].value) || 0,
          parseFloat(colData[2].value) || 0,
          parseFloat(colData[3].value) || 0,
          parseFloat(colData[4].value) || 0,
          parseFloat(colData[5].value) || 0,
          parseFloat(colData[6].value) || 0,
          report.Header.Time ? new Date(report.Header.Time) : null,
          report.Header.Option.find(o => o.Name === "report_date")?.Value || null
        ]
      );
    }

    res.status(200).send({ message: "Aged payables saved successfully" });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).send({ error: "DB insert failed" });
  } finally {
    client.release();
  }
});




app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
