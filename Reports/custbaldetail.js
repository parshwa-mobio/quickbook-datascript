const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post("/customer-balance-detail", async (req, res) => {
  try {
    const report = req.body;

    const reportDate =
      report.Header.Option.find((opt) => opt.Name === "report_date")?.Value ||
      report.Header.EndPeriod;

    if (!reportDate)
      return res.status(400).json({ message: "Report date missing" });

    const rows = report.Rows.Row;
    const insertPromises = [];

    const processRow = (row, customer = null, subSection = null) => {
      // Nested Rows (Sections)
      if (row.Rows && row.Rows.Row) {
        const currentCustomer = row.Header?.ColData[0]?.value || customer;
        row.Rows.Row.forEach((nestedRow) =>
          processRow(nestedRow, currentCustomer, row.Header?.ColData[0]?.value)
        );
      }

      // Data Rows
      if (row.ColData) {
        const col = row.ColData;
        const tx_date = col[0]?.value || null;
        const txn_type = col[1]?.value || null;
        const doc_num = col[2]?.value || null;
        const due_date = col[3]?.value || null;
        const amount = parseFloat(col[4]?.value) || 0;
        const open_balance = parseFloat(col[5]?.value) || 0;
        const balance = parseFloat(col[6]?.value) || 0;

        if (customer) {
          insertPromises.push(
            pool.query(
              `INSERT INTO customer_balance_detail
               (report_date, customer_name, sub_section, tx_date, txn_type, doc_num, due_date, amount, open_balance, balance)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
               ON CONFLICT(report_date, customer_name, sub_section, doc_num)
               DO UPDATE SET amount=EXCLUDED.amount, open_balance=EXCLUDED.open_balance, balance=EXCLUDED.balance`,
              [
                reportDate,
                customer,
                subSection,
                tx_date,
                txn_type,
                doc_num,
                due_date,
                amount,
                open_balance,
                balance,
              ]
            )
          );
        }
      }

      // Summary Rows
      if (row.Summary && row.Summary.ColData) {
        const col = row.Summary.ColData;
        const amount = parseFloat(col[4]?.value) || 0;
        const open_balance = parseFloat(col[5]?.value) || 0;

        if (customer) {
          insertPromises.push(
            pool.query(
              `INSERT INTO customer_balance_detail
               (report_date, customer_name, sub_section, amount, open_balance)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT(report_date, customer_name, sub_section)
               DO UPDATE SET amount=EXCLUDED.amount, open_balance=EXCLUDED.open_balance`,
              [reportDate, customer, subSection, amount, open_balance]
            )
          );
        }
      }
    };

    rows.forEach((row) => processRow(row));

    await Promise.all(insertPromises);

    res.json({ message: "Customer Balance Detail saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});


app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
