const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post("/journal-report", async (req, res) => {
  try {
    const report = req.body;
    const reportDate =
      report.Header.Option.find((opt) => opt.Name === "report_date")?.Value ||
      report.Header.EndPeriod;

    if (!reportDate)
      return res.status(400).json({ message: "Report date missing" });

    const rows = report.Rows.Row;
    const insertPromises = [];

    const processRow = (row) => {
      // Recursively process nested Rows if exist
      if (row.Rows && row.Rows.Row) {
        row.Rows.Row.forEach((nestedRow) => processRow(nestedRow));
      }

      // Process main ColData
      if (row.ColData) {
        const col = row.ColData;

        const tx_date_raw = col[0]?.value || null;
        // Convert invalid dates to null
        const tx_date = !tx_date_raw || tx_date_raw === "0-00-00" || isNaN(Date.parse(tx_date_raw))
          ? null
          : tx_date_raw;

        const txn_type = col[1]?.value || null;
        const doc_num = col[2]?.value || null;
        const name = col[3]?.value || null;
        const memo = col[4]?.value || null;
        const account_name = col[5]?.value || null;
        const debit = parseFloat(col[6]?.value) || 0;
        const credit = parseFloat(col[7]?.value) || 0;

        insertPromises.push(
          pool.query(
            `INSERT INTO journal_report 
             (report_date, tx_date, txn_type, doc_num, name, memo, account_name, debit, credit)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT(report_date, tx_date, txn_type, doc_num, account_name) 
             DO UPDATE SET 
             debit = EXCLUDED.debit, 
             credit = EXCLUDED.credit, 
             name = EXCLUDED.name, 
             memo = EXCLUDED.memo`,
            [reportDate, tx_date, txn_type, doc_num, name, memo, account_name, debit, credit]
          )
        );
      }

      // Process Summary if exists
      if (row.Summary && row.Summary.ColData) {
        const col = row.Summary.ColData;
        const debit = parseFloat(col[6]?.value) || 0;
        const credit = parseFloat(col[7]?.value) || 0;
        insertPromises.push(
          pool.query(
            `INSERT INTO journal_report_summary 
             (report_date, total_debit, total_credit)
             VALUES ($1,$2,$3)
             ON CONFLICT(report_date) DO UPDATE SET
             total_debit = EXCLUDED.total_debit,
             total_credit = EXCLUDED.total_credit`,
            [reportDate, debit, credit]
          )
        );
      }
    };

    rows.forEach((row) => processRow(row));
    await Promise.all(insertPromises);

    res.json({ message: "Journal Report saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});


app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
