const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
app.use(bodyParser.json());

app.post("/balance-sheet", async (req, res) => {
  try {
    const report = req.body;
    const reportDate =
      report.Header.Option.find((opt) => opt.Name === "report_date")?.Value ||
      report.Header.EndPeriod;

    if (!reportDate)
      return res.status(400).json({ message: "Report date missing" });

    const rows = report.Rows.Row;
    const insertPromises = [];

    // Recursive function to process nested sections
    const processRow = (row) => {
      // Process nested Rows
      if (row.Rows && row.Rows.Row) {
        row.Rows.Row.forEach((nestedRow) => processRow(nestedRow));
      }

      // Process ColData if exists
      if (row.ColData) {
        const col = row.ColData;
        const account_name = col[0]?.value || null;
        const total = parseFloat(col[1]?.value) || 0;

        if (account_name) {
          insertPromises.push(
            pool.query(
              `INSERT INTO balance_sheet (report_date, account_name, total)
                             VALUES ($1, $2, $3)
                             ON CONFLICT(report_date, account_name) DO UPDATE SET
                             total = EXCLUDED.total`,
              [reportDate, account_name, total]
            )
          );
        }
      }

      // Process Summary if exists
      if (row.Summary && row.Summary.ColData) {
        const col = row.Summary.ColData;
        const account_name = col[0]?.value || null;
        const total = parseFloat(col[1]?.value) || 0;

        if (account_name) {
          insertPromises.push(
            pool.query(
              `INSERT INTO balance_sheet (report_date, account_name, total)
                             VALUES ($1, $2, $3)
                             ON CONFLICT(report_date, account_name) DO UPDATE SET
                             total = EXCLUDED.total`,
              [reportDate, account_name, total]
            )
          );
        }
      }
    };

    rows.forEach((row) => processRow(row));

    await Promise.all(insertPromises);

    res.json({ message: "Balance Sheet saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
