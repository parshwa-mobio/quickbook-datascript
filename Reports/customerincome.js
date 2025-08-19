const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post("/customer-income", async (req, res) => {
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
        const income = parseFloat(col[1]?.value) || 0;
        const expense = parseFloat(col[2]?.value) || 0;
        const net_income = parseFloat(col[3]?.value) || 0;

        if (customer) {
          insertPromises.push(
            pool.query(
              `INSERT INTO customer_income
               (report_date, customer_name, sub_section, income, expense, net_income)
               VALUES ($1,$2,$3,$4,$5,$6)
               ON CONFLICT(report_date, customer_name, sub_section)
               DO UPDATE SET income=EXCLUDED.income, expense=EXCLUDED.expense, net_income=EXCLUDED.net_income`,
              [reportDate, customer, subSection, income, expense, net_income]
            )
          );
        }
      }

      // Summary Rows
      if (row.Summary && row.Summary.ColData) {
        const col = row.Summary.ColData;
        const income = parseFloat(col[1]?.value) || 0;
        const expense = parseFloat(col[2]?.value) || 0;
        const net_income = parseFloat(col[3]?.value) || 0;

        if (customer) {
          insertPromises.push(
            pool.query(
              `INSERT INTO customer_income
               (report_date, customer_name, sub_section, income, expense, net_income)
               VALUES ($1,$2,$3,$4,$5,$6)
               ON CONFLICT(report_date, customer_name, sub_section)
               DO UPDATE SET income=EXCLUDED.income, expense=EXCLUDED.expense, net_income=EXCLUDED.net_income`,
              [reportDate, customer, subSection, income, expense, net_income]
            )
          );
        }
      }
    };

    rows.forEach((row) => processRow(row));

    await Promise.all(insertPromises);

    res.json({ message: "Customer Income saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
