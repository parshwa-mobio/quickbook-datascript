const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post("/save-aged-receivable-detail", async (req, res) => {
  const report = req.body;
  const client = await pool.connect();

  try {
    for (let section of report.Rows.Row) {
      const sectionName = section.Header?.ColData?.[0]?.value || null;

      // Only process if there are actual data rows
      if (section.Rows?.Row && Array.isArray(section.Rows.Row)) {
        for (let row of section.Rows.Row) {
          const cols = row.ColData || [];

          await client.query(
            `INSERT INTO aged_receivable_detail (
                report_time, report_name, start_period, end_period, currency,
                section_name, txn_date, txn_type, doc_num, customer_name, customer_id,
                due_date, amount, open_balance
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
            )
            ON CONFLICT (txn_type, doc_num, customer_id, txn_date) DO UPDATE
            SET section_name = EXCLUDED.section_name,
                amount = EXCLUDED.amount,
                open_balance = EXCLUDED.open_balance`,
            [
              report.Header.Time ? new Date(report.Header.Time) : null,
              report.Header.ReportName || null,
              report.Header.StartPeriod ? new Date(report.Header.StartPeriod) : null,
              report.Header.EndPeriod ? new Date(report.Header.EndPeriod) : null,
              report.Header.Currency || null,
              sectionName,
              cols[0]?.value ? new Date(cols[0].value) : null, // txn_date
              cols[1]?.value || null, // txn_type
              cols[2]?.value || null, // doc_num
              cols[3]?.value || null, // customer_name
              cols[3]?.id || null,    // customer_id
              cols[4]?.value ? new Date(cols[4].value) : null, // due_date
              parseFloat(cols[5]?.value) || 0, // amount
              parseFloat(cols[6]?.value) || 0  // open_balance
            ]
          );
        }
      }
    }

    res.status(200).send({ message: "Aged Receivable Detail saved successfully" });
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
