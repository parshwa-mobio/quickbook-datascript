const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post("/general-ledger", async (req, res) => {
  try {
    const report = req.body;

    const reportDate =
      report.Header.Option.find((opt) => opt.Name === "report_date")?.Value ||
      report.Header.EndPeriod;

    if (!reportDate)
      return res.status(400).json({ message: "Report date missing" });

    const rows = report.Rows.Row;
    const insertPromises = [];

    const processRow = (row, account = null, subSection = null) => {
      // Nested Rows (Sections)
      if (row.Rows && row.Rows.Row) {
        const currentAccount = row.Header?.ColData[0]?.value || account;
        row.Rows.Row.forEach((nestedRow) =>
          processRow(nestedRow, currentAccount, row.Header?.ColData[0]?.value)
        );
      }

      // Data Rows
      if (row.ColData) {
        const col = row.ColData;
        const tx_date = col[0]?.value || null;
        const txn_type = col[1]?.value || null;
        const doc_num = col[2]?.value || null;
        const name = col[3]?.value || null;
        const memo = col[4]?.value || null;
        const split = col[5]?.value || null;
        const amount = parseFloat(col[6]?.value) || 0;
        const balance = parseFloat(col[7]?.value) || 0;

        if (account) {
          insertPromises.push(
            pool.query(
              `INSERT INTO general_ledger
               (report_date, account_name, sub_section, tx_date, txn_type, doc_num, name, memo, split, amount, balance)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
               ON CONFLICT(report_date, account_name, sub_section, tx_date, txn_type, doc_num)
               DO UPDATE SET amount=EXCLUDED.amount, balance=EXCLUDED.balance, name=EXCLUDED.name, memo=EXCLUDED.memo, split=EXCLUDED.split`,
              [
                reportDate,
                account,
                subSection,
                tx_date,
                txn_type,
                doc_num,
                name,
                memo,
                split,
                amount,
                balance,
              ]
            )
          );
        }
      }

      // Summary Rows
      if (row.Summary && row.Summary.ColData) {
        const col = row.Summary.ColData;
        const tx_date = null;
        const txn_type = null;
        const doc_num = null;
        const name = null;
        const memo = null;
        const split = null;
        const amount = parseFloat(col[6]?.value) || 0;
        const balance = parseFloat(col[7]?.value) || 0;

        if (account) {
          insertPromises.push(
            pool.query(
              `INSERT INTO general_ledger
               (report_date, account_name, sub_section, tx_date, txn_type, doc_num, name, memo, split, amount, balance)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
               ON CONFLICT(report_date, account_name, sub_section, tx_date, txn_type, doc_num)
               DO UPDATE SET amount=EXCLUDED.amount, balance=EXCLUDED.balance`,
              [reportDate, account, subSection, tx_date, txn_type, doc_num, name, memo, split, amount, balance]
            )
          );
        }
      }
    };

    rows.forEach((row) => processRow(row));

    await Promise.all(insertPromises);

    res.json({ message: "General Ledger saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});


app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
