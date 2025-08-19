const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
app.use(bodyParser.json());

app.post("/cashflow", async (req, res) => {
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
    res.status(200).send({ message: "Purchases saved successfully" });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Error inserting purchases:", err);
    res.status(500).send({ error: "Database insert failed" });
  } finally {
    db.release();
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
