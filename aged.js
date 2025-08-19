const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const router = express.Router();
router.use(bodyParser.json());

// Aged Payable Detail API
router.post("/save-aged-payable-detail", async (req, res) => {
  const report = req.body;

  const client = await pool.connect();
  try {
    const reportName = report.Header.ReportName;
    const reportTime = report.Header.Time ? new Date(report.Header.Time) : null;
    const startPeriod = report.Header.StartPeriod ? new Date(report.Header.StartPeriod) : null;
    const endPeriod = report.Header.EndPeriod ? new Date(report.Header.EndPeriod) : null;
    const currency = report.Header.Currency;

    for (let section of report.Rows.Row) {
      const sectionName = section.Header?.ColData[0]?.value || null;

      // Insert data rows
      if (section.Rows?.Row) {
        for (let row of section.Rows.Row) {
          const col = row.ColData;
          await client.query(
            `INSERT INTO aged_payable_detail (
              report_name, report_time, date_macro, start_period, end_period, currency,
              section_name, row_type,
              tx_date, txn_type, doc_num, vend_name, vend_id, due_date, past_due,
              subt_neg_amount, subt_neg_open_bal,
              summary_label, summary_amount, summary_open_bal
            ) VALUES (
              $1,$2,$3,$4,$5,$6,
              $7,$8,
              $9,$10,$11,$12,$13,$14,$15,
              $16,$17,
              NULL, NULL, NULL
            )
            ON CONFLICT (report_name, doc_num, vend_id, tx_date)
            DO UPDATE SET
              tx_date = EXCLUDED.tx_date,
              txn_type = EXCLUDED.txn_type,
              vend_name = EXCLUDED.vend_name,
              due_date = EXCLUDED.due_date,
              past_due = EXCLUDED.past_due,
              subt_neg_amount = EXCLUDED.subt_neg_amount,
              subt_neg_open_bal = EXCLUDED.subt_neg_open_bal,
              section_name = EXCLUDED.section_name`,
            [
              reportName,
              reportTime,
              report.Header.DateMacro || null,
              startPeriod,
              endPeriod,
              currency,
              sectionName,
              row.type || "Data",
              col[0]?.value ? new Date(col[0].value) : null,
              col[1]?.value || null,
              col[2]?.value || null,
              col[3]?.value || null,
              col[3]?.id || null,
              col[4]?.value ? new Date(col[4].value) : null,
              col[5]?.value ? parseInt(col[5].value) : null,
              col[6]?.value ? parseFloat(col[6].value) : null,
              col[7]?.value ? parseFloat(col[7].value) : null
            ]
          );
        }
      }

      // Insert section summary if exists
      if (section.Summary?.ColData) {
        const sCol = section.Summary.ColData;
        await client.query(
          `INSERT INTO aged_payable_detail (
            report_name, report_time, date_macro, start_period, end_period, currency,
            section_name, row_type,
            summary_label, summary_amount, summary_open_bal
          ) VALUES (
            $1,$2,$3,$4,$5,$6,
            $7,'Section',
            $8,$9,$10
          )
          ON CONFLICT (report_name, section_name, summary_label)
          DO UPDATE SET
            summary_amount = EXCLUDED.summary_amount,
            summary_open_bal = EXCLUDED.summary_open_bal`,
          [
            reportName,
            reportTime,
            report.Header.DateMacro || null,
            startPeriod,
            endPeriod,
            currency,
            sectionName,
            sCol[0]?.value || null,
            sCol[6]?.value ? parseFloat(sCol[6].value) : null,
            sCol[7]?.value ? parseFloat(sCol[7].value) : null
          ]
        );
      }
    }

    res.status(200).send({ message: "Aged Payable Detail saved successfully" });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).send({ error: "DB insert failed" });
  } finally {
    client.release();
  }
});

// Aged Payables API
router.post("/save-aged-payables", async (req, res) => {
  const report = req.body;
  const rows = report.Rows.Row;

  const client = await pool.connect();
  try {
    for (let row of rows) {
      if (row.Summary) continue; // skip summary row

      const colData = row.ColData;
      const vendor = colData[0];
      
      await client.query(
        `INSERT INTO aged_payables (
            vendor_id, vendor_name, amt_current, amt_1_30, amt_31_60, amt_61_90, amt_91_over, total_amt, report_time, report_date
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
        )
        ON CONFLICT (vendor_id) DO UPDATE
        SET vendor_name = EXCLUDED.vendor_name,
            amt_current = EXCLUDED.amt_current,
            amt_1_30 = EXCLUDED.amt_1_30,
            amt_31_60 = EXCLUDED.amt_31_60,
            amt_61_90 = EXCLUDED.amt_61_90,
            amt_91_over = EXCLUDED.amt_91_over,
            total_amt = EXCLUDED.total_amt,
            report_time = EXCLUDED.report_time,
            report_date = EXCLUDED.report_date`,
        [
          vendor.id || null,
          vendor.value || null,
          parseFloat(colData[1].value) || 0,
          parseFloat(colData[2].value) || 0,
          parseFloat(colData[3].value) || 0,
          parseFloat(colData[4].value) || 0,
          parseFloat(colData[5].value) || 0,
          parseFloat(colData[6].value) || 0,
          report.Header.Time ? new Date(report.Header.Time) : null,
          report.Header.Option.find(o => o.Name === "report_date")?.Value || null
        ]
      );
    }

    res.status(200).send({ message: "Aged payables saved successfully" });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).send({ error: "DB insert failed" });
  } finally {
    client.release();
  }
});

// Aged Receivable Detail API
router.post("/save-aged-receivable-detail", async (req, res) => {
  const report = req.body;
  const client = await pool.connect();

  try {
    for (let section of report.Rows.Row) {
      const sectionName = section.Header?.ColData?.[0]?.value || null;

      // Only process if there are actual data rows
      if (section.Rows?.Row && Array.isArray(section.Rows.Row)) {
        for (let row of section.Rows.Row) {
          const cols = row.ColData || [];

          await client.query(
            `INSERT INTO aged_receivable_detail (
                report_time, report_name, start_period, end_period, currency,
                section_name, txn_date, txn_type, doc_num, customer_name, customer_id,
                due_date, amount, open_balance
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
            )
            ON CONFLICT (txn_type, doc_num, customer_id, txn_date) DO UPDATE
            SET section_name = EXCLUDED.section_name,
                amount = EXCLUDED.amount,
                open_balance = EXCLUDED.open_balance`,
            [
              report.Header.Time ? new Date(report.Header.Time) : null,
              report.Header.ReportName || null,
              report.Header.StartPeriod ? new Date(report.Header.StartPeriod) : null,
              report.Header.EndPeriod ? new Date(report.Header.EndPeriod) : null,
              report.Header.Currency || null,
              sectionName,
              cols[0]?.value ? new Date(cols[0].value) : null, // txn_date
              cols[1]?.value || null, // txn_type
              cols[2]?.value || null, // doc_num
              cols[3]?.value || null, // customer_name
              cols[3]?.id || null,    // customer_id
              cols[4]?.value ? new Date(cols[4].value) : null, // due_date
              parseFloat(cols[5]?.value) || 0, // amount
              parseFloat(cols[6]?.value) || 0  // open_balance
            ]
          );
        }
      }
    }

    res.status(200).send({ message: "Aged Receivable Detail saved successfully" });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).send({ error: "DB insert failed" });
  } finally {
    client.release();
  }
});

// Aged Receivables API
router.post('/aged-receivables', async (req, res) => {
    try {
        const report = req.body;
        const reportDate = report.Header.Option.find(opt => opt.Name === 'report_date')?.Value;

        if (!reportDate) return res.status(400).json({ message: 'Report date missing' });

        const rows = report.Rows.Row;
        const insertPromises = [];

        const processRow = (row) => {
            // Check if it's a Section with nested Rows
            if (row.Rows && row.Rows.Row) {
                row.Rows.Row.forEach(nestedRow => processRow(nestedRow));
            } else if (row.ColData) {
                const col = row.ColData;
                const customer_name = col[0]?.value || null;
                const current = parseFloat(col[1]?.value) || 0;
                const days_1_30 = parseFloat(col[2]?.value) || 0;
                const days_31_60 = parseFloat(col[3]?.value) || 0;
                const days_61_90 = parseFloat(col[4]?.value) || 0;
                const days_91_over = parseFloat(col[5]?.value) || 0;
                const total = parseFloat(col[6]?.value) || 0;

                insertPromises.push(
                    pool.query(
                        `INSERT INTO aged_receivables
                        (report_date, customer_name, current, days_1_30, days_31_60, days_61_90, days_91_over, total)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                        ON CONFLICT(report_date, customer_name) DO UPDATE SET
                        current=EXCLUDED.current,
                        days_1_30=EXCLUDED.days_1_30,
                        days_31_60=EXCLUDED.days_31_60,
                        days_61_90=EXCLUDED.days_61_90,
                        days_91_over=EXCLUDED.days_91_over,
                        total=EXCLUDED.total`,
                        [reportDate, customer_name, current, days_1_30, days_31_60, days_61_90, days_91_over, total]
                    )
                );
            }
        };

        rows.forEach(row => processRow(row));

        await Promise.all(insertPromises);

        res.json({ message: 'Aged Receivables saved successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

module.exports = router;
