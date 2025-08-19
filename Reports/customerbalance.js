const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post("/customer-balance", async (req, res) => {
  try {
    const report = req.body;

    const reportDate =
      report.Header.Option.find((opt) => opt.Name === "report_date")?.Value ||
      report.Header.EndPeriod;

    if (!reportDate)
      return res.status(400).json({ message: "Report date missing" });

    const rows = report.Rows.Row;
    const insertPromises = [];

    const processRow = (row, section = null) => {
      // Nested Rows in sections
      if (row.Rows && row.Rows.Row) {
        const sectionName = row.Header?.ColData[0]?.value || section;
        row.Rows.Row.forEach((nestedRow) => processRow(nestedRow, sectionName));
      }

      // Normal ColData rows
      if (row.ColData) {
        const col = row.ColData;
        const customer_name = col[0]?.value || null;
        const total = parseFloat(col[1]?.value) || 0;

        if (customer_name) {
          insertPromises.push(
            pool.query(
              `INSERT INTO customer_balance (report_date, section, customer_name, total)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT(report_date, section, customer_name)
               DO UPDATE SET total = EXCLUDED.total`,
              [reportDate, section, customer_name, total]
            )
          );
        }
      }

      // Summary rows
      if (row.Summary && row.Summary.ColData) {
        const col = row.Summary.ColData;
        const customer_name = col[0]?.value || null;
        const total = parseFloat(col[1]?.value) || 0;

        if (customer_name) {
          insertPromises.push(
            pool.query(
              `INSERT INTO customer_balance (report_date, section, customer_name, total)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT(report_date, section, customer_name)
               DO UPDATE SET total = EXCLUDED.total`,
              [reportDate, section, customer_name, total]
            )
          );
        }
      }
    };

    rows.forEach((row) => processRow(row));

    await Promise.all(insertPromises);

    res.json({ message: "Customer Balance saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});



app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
