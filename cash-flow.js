const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const router = express.Router();
router.use(bodyParser.json());

// Original Cash Flow Report API (from cash-flow.js)
router.post("/", async (req, res) => {
  const reportData = req.body;
  const db = await pool.connect();
  try {
    await db.query("BEGIN");

    // 1. Insert into cashflow_report
    const reportRes = await db.query(
      `INSERT INTO cashflow_report 
            (report_time, report_name, date_macro, start_period, end_period, summarize_columns_by, currency, no_report_data) 
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING report_id`,
      [
        reportData.Header.Time,
        reportData.Header.ReportName,
        reportData.Header.DateMacro,
        reportData.Header.StartPeriod,
        reportData.Header.EndPeriod,
        reportData.Header.SummarizeColumnsBy,
        reportData.Header.Currency,
        reportData.Header.Option?.find((o) => o.Name === "NoReportData")
          ?.Value === "true",
      ]
    );
    const reportId = reportRes.rows[0].report_id;

    // 2. Process sections
    for (const section of reportData.Rows.Row) {
      const sectionName = section.Header?.ColData?.[0]?.value || null;
      const sectionGroup = section.group || null;
      const summaryLabel = section.Summary?.ColData?.[0]?.value || null;
      const summaryValue = section.Summary?.ColData?.[1]?.value
        ? parseFloat(section.Summary.ColData[1].value)
        : null;

      const secRes = await db.query(
        `INSERT INTO cashflow_section (report_id, section_name, section_group, summary_label, summary_value) 
                VALUES ($1,$2,$3,$4,$5) RETURNING section_id`,
        [reportId, sectionName, sectionGroup, summaryLabel, summaryValue]
      );
      const sectionId = secRes.rows[0].section_id;

      // 3. Insert lines for this section
      if (section.Rows?.Row) {
        for (const line of section.Rows.Row) {
          if (line.type === "Data") {
            const accountName = line.ColData?.[0]?.value || null;
            const accountId = line.ColData?.[0]?.id
              ? parseInt(line.ColData[0].id)
              : null;
            const amount = line.ColData?.[1]?.value
              ? parseFloat(line.ColData[1].value)
              : null;

            await db.query(
              `INSERT INTO cashflow_line (section_id, account_name, account_id, amount, line_type, line_group) 
                            VALUES ($1,$2,$3,$4,$5,$6)`,
              [
                sectionId,
                accountName,
                accountId,
                amount,
                line.type,
                line.group || null,
              ]
            );
          }
          // Handle nested subsections
          if (line.Rows?.Row) {
            for (const subLine of line.Rows.Row) {
              const accountName = subLine.ColData?.[0]?.value || null;
              const accountId = subLine.ColData?.[0]?.id
                ? parseInt(subLine.ColData[0].id)
                : null;
              const amount = subLine.ColData?.[1]?.value
                ? parseFloat(subLine.ColData[1].value)
                : null;

              await db.query(
                `INSERT INTO cashflow_line (section_id, account_name, account_id, amount, line_type, line_group) 
                                VALUES ($1,$2,$3,$4,$5,$6)`,
                [
                  sectionId,
                  accountName,
                  accountId,
                  amount,
                  subLine.type,
                  subLine.group || null,
                ]
              );
            }
          }
        }
      }
    }
    await db.query("COMMIT");
    res.status(200).send({ message: "Cash flow report saved successfully" });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Error inserting cash flow report:", err);
    res.status(500).send({ error: "Database insert failed" });
  } finally {
    db.release();
  }
});

// Alternative Cash Flow API (from cashflow.js)
router.post("/cash-flow", async (req, res) => {
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
        row.Rows.Row.forEach((nestedRow) => processRow(nestedRow, row.Header?.ColData[0]?.value || section));
      }

      // Normal ColData rows
      if (row.ColData) {
        const col = row.ColData;
        const account_name = col[0]?.value || null;
        const total = parseFloat(col[1]?.value) || 0;

        if (account_name) {
          insertPromises.push(
            pool.query(
              `INSERT INTO cash_flow (report_date, section, account_name, total)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT(report_date, section, account_name)
               DO UPDATE SET total = EXCLUDED.total`,
              [reportDate, section, account_name, total]
            )
          );
        }
      }

      // Summary rows
      if (row.Summary && row.Summary.ColData) {
        const col = row.Summary.ColData;
        const account_name = col[0]?.value || null;
        const total = parseFloat(col[1]?.value) || 0;

        if (account_name) {
          insertPromises.push(
            pool.query(
              `INSERT INTO cash_flow (report_date, section, account_name, total)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT(report_date, section, account_name)
               DO UPDATE SET total = EXCLUDED.total`,
              [reportDate, section, account_name, total]
            )
          );
        }
      }
    };

    rows.forEach((row) => processRow(row));

    await Promise.all(insertPromises);

    res.json({ message: "Cash Flow saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

module.exports = router;
