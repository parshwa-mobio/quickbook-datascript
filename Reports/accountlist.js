const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post("/save-report-accounts", async (req, res) => {
  const report = req.body;

  const client = await pool.connect();
  try {
    const reportName = report.Header.ReportName;
    const currency = report.Header.Currency;
    const reportTime = report.Header.Time;

    for (let row of report.Rows.Row) {
      const accountName = row.ColData[0]?.value || null;
      const accountType = row.ColData[1]?.value || null;
      const detailAccType = row.ColData[2]?.value || null;
      const accountDesc = row.ColData[3]?.value || null;
      const accountBal = row.ColData[4]?.value || null;

      await client.query(
        `INSERT INTO report_accounts (
                    report_name, account_name, account_type, detail_acc_type, account_desc, account_bal, currency, report_time
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8
                )
                ON CONFLICT (report_name, account_name) DO UPDATE
                SET account_type = EXCLUDED.account_type,
                    detail_acc_type = EXCLUDED.detail_acc_type,
                    account_desc = EXCLUDED.account_desc,
                    account_bal = EXCLUDED.account_bal,
                    currency = EXCLUDED.currency,
                    report_time = EXCLUDED.report_time`,
        [
          reportName,
          accountName,
          accountType,
          detailAccType,
          accountDesc,
          accountBal,
          currency,
          reportTime,
        ]
      );
    }

    res.status(200).send({ message: "Report accounts saved successfully" });
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
