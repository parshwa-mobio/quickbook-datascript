const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db"); // your pg connection pool

const app = express();
app.use(bodyParser.json());

app.post("/profit-loss-detail", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const response = req.body;
    const header = response.Header || {};
    const rows = response.Rows?.Row || [];

    const processRow = async (row, sectionName = null) => {
      if (row.type === "Data" && row.ColData) {
        const colData = row.ColData.map((c) => c.value || null);
        const ids = row.ColData.map((c) => c.id || null);

        await client.query(
          `INSERT INTO profit_and_loss_details (
          report_time, report_name, date_macro, report_basis, start_period, end_period, currency,
          txn_date, txn_type, txn_id, doc_num, name, name_id, memo, split_account, split_account_id, amount, balance,
          section_name
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,
                  $8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
                  $19)`,
          [
            header.Time,
            header.ReportName,
            header.DateMacro,
            header.ReportBasis,
            header.StartPeriod,
            header.EndPeriod,
            header.Currency,

            colData[0], // txn_date
            colData[1], // txn_type
            ids[1], // txn_id
            colData[2], // doc_num
            colData[3], // name
            ids[3], // name_id
            colData[4], // memo/desc
            colData[5], // split
            ids[5], // split_account_id
            colData[6], // amount
            colData[7], // balance

            sectionName,
          ]
        );
      }

      if (row.type === "Section") {
        const sectionLabel = row.Header?.ColData?.[0]?.value || sectionName;
        const sectionTotal = row.Summary?.ColData?.[6]?.value || null;

        // Insert section total as summary row
        if (sectionTotal) {
          await client.query(
            `INSERT INTO profit_and_loss_details (
            report_time, report_name, date_macro, report_basis, start_period, end_period, currency,
            section_name, section_total
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,
                    $8,$9)`,
            [
              header.Time,
              header.ReportName,
              header.DateMacro,
              header.ReportBasis,
              header.StartPeriod,
              header.EndPeriod,
              header.Currency,

              sectionLabel,
              sectionTotal,
            ]
          );
        }

        // Process nested rows
        if (row.Rows?.Row) {
          for (const child of row.Rows.Row) {
            await processRow(child, sectionLabel);
          }
        }
      }

      if (row.Summary && row.Summary.ColData?.[0]?.value === "Gross Profit") {
        const summaryLabel = "Gross Profit";
        const summaryValue = row.Summary.ColData?.[6]?.value;

        await client.query(
          `INSERT INTO profit_and_loss_details (
          report_time, report_name, date_macro, report_basis, start_period, end_period, currency,
          summary_label, summary_value
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,
                  $8,$9)`,
          [
            header.Time,
            header.ReportName,
            header.DateMacro,
            header.ReportBasis,
            header.StartPeriod,
            header.EndPeriod,
            header.Currency,

            summaryLabel,
            summaryValue,
          ]
        );
      }
    };

    // Process all top-level rows
    for (const row of rows) {
      await processRow(row);
    }

    await client.query("COMMIT");
    res
      .status(200)
      .json({ message: "Profit & Loss Report saved successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving Profit & Loss Report:", error);
    res.status(500).json({ error: "Failed to save Profit & Loss Report" });
  } finally {
    client.release();
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
