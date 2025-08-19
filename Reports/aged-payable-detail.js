const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post("/save-aged-payable-detail", async (req, res) => {
  const report = req.body;

  const client = await pool.connect();
  try {
    const reportName = report.Header.ReportName;
    const reportTime = report.Header.Time ? new Date(report.Header.Time) : null;
    const startPeriod = report.Header.StartPeriod ? new Date(report.Header.StartPeriod) : null;
    const endPeriod = report.Header.EndPeriod ? new Date(report.Header.EndPeriod) : null;
    const currency = report.Header.Currency;

    for (let section of report.Rows.Row) {
      const sectionName = section.Header?.ColData[0]?.value || null;

      // Insert data rows
      if (section.Rows?.Row) {
        for (let row of section.Rows.Row) {
          const col = row.ColData;
          await client.query(
            `INSERT INTO aged_payable_detail (
              report_name, report_time, date_macro, start_period, end_period, currency,
              section_name, row_type,
              tx_date, txn_type, doc_num, vend_name, vend_id, due_date, past_due,
              subt_neg_amount, subt_neg_open_bal,
              summary_label, summary_amount, summary_open_bal
            ) VALUES (
              $1,$2,$3,$4,$5,$6,
              $7,$8,
              $9,$10,$11,$12,$13,$14,$15,
              $16,$17,
              NULL, NULL, NULL
            )
            ON CONFLICT (report_name, doc_num, vend_id, tx_date)
            DO UPDATE SET
              tx_date = EXCLUDED.tx_date,
              txn_type = EXCLUDED.txn_type,
              vend_name = EXCLUDED.vend_name,
              due_date = EXCLUDED.due_date,
              past_due = EXCLUDED.past_due,
              subt_neg_amount = EXCLUDED.subt_neg_amount,
              subt_neg_open_bal = EXCLUDED.subt_neg_open_bal,
              section_name = EXCLUDED.section_name`,
            [
              reportName,
              reportTime,
              report.Header.DateMacro || null,
              startPeriod,
              endPeriod,
              currency,
              sectionName,
              row.type || "Data",
              col[0]?.value ? new Date(col[0].value) : null,
              col[1]?.value || null,
              col[2]?.value || null,
              col[3]?.value || null,
              col[3]?.id || null,
              col[4]?.value ? new Date(col[4].value) : null,
              col[5]?.value ? parseInt(col[5].value) : null,
              col[6]?.value ? parseFloat(col[6].value) : null,
              col[7]?.value ? parseFloat(col[7].value) : null
            ]
          );
        }
      }

      // Insert section summary if exists
      if (section.Summary?.ColData) {
        const sCol = section.Summary.ColData;
        await client.query(
          `INSERT INTO aged_payable_detail (
            report_name, report_time, date_macro, start_period, end_period, currency,
            section_name, row_type,
            summary_label, summary_amount, summary_open_bal
          ) VALUES (
            $1,$2,$3,$4,$5,$6,
            $7,'Section',
            $8,$9,$10
          )
          ON CONFLICT (report_name, section_name, summary_label)
          DO UPDATE SET
            summary_amount = EXCLUDED.summary_amount,
            summary_open_bal = EXCLUDED.summary_open_bal`,
          [
            reportName,
            reportTime,
            report.Header.DateMacro || null,
            startPeriod,
            endPeriod,
            currency,
            sectionName,
            sCol[0]?.value || null,
            sCol[6]?.value ? parseFloat(sCol[6].value) : null,
            sCol[7]?.value ? parseFloat(sCol[7].value) : null
          ]
        );
      }
    }

    res.status(200).send({ message: "Aged Payable Detail saved successfully" });
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
