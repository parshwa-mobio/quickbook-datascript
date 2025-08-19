const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const router = express.Router();
router.use(bodyParser.json());

// Save Journal Entries API
router.post("/", async (req, res) => {
  const journalEntries = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const je of journalEntries) {
      // Insert journal entry header
      await client.query(
        `INSERT INTO journal_entries (
              id, adjustment, total_amt, domain, sparse, sync_token, 
              created_at, updated_at, txn_date, currency_value, currency_name, private_note
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          ON CONFLICT (id) DO UPDATE SET
              adjustment = EXCLUDED.adjustment,
              total_amt = EXCLUDED.total_amt,
              domain = EXCLUDED.domain,
              sparse = EXCLUDED.sparse,
              sync_token = EXCLUDED.sync_token,
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at,
              txn_date = EXCLUDED.txn_date,
              currency_value = EXCLUDED.currency_value,
              currency_name = EXCLUDED.currency_name,
              private_note = EXCLUDED.private_note`,
        [
          je.Id,
          je.Adjustment,
          je.TotalAmt,
          je.domain,
          je.sparse,
          je.SyncToken,
          je.MetaData?.CreateTime ? new Date(je.MetaData.CreateTime) : null,
          je.MetaData?.LastUpdatedTime
            ? new Date(je.MetaData.LastUpdatedTime)
            : null,
          je.TxnDate,
          je.CurrencyRef?.value,
          je.CurrencyRef?.name,
          je.PrivateNote,
        ]
      );

      // Insert lines
      for (const line of je.Line) {
        await client.query(
          `INSERT INTO journal_entry_lines (
                  line_id, journal_entry_id, description, amount, detail_type, posting_type,
                  account_ref_value, account_ref_name
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
              ON CONFLICT (journal_entry_id, line_id) DO UPDATE SET
                  description = EXCLUDED.description,
                  amount = EXCLUDED.amount,
                  detail_type = EXCLUDED.detail_type,
                  posting_type = EXCLUDED.posting_type,
                  account_ref_value = EXCLUDED.account_ref_value,
                  account_ref_name = EXCLUDED.account_ref_name`,
          [
            line.Id,
            je.Id,
            line.Description,
            line.Amount,
            line.DetailType,
            line.JournalEntryLineDetail?.PostingType,
            line.JournalEntryLineDetail?.AccountRef?.value,
            line.JournalEntryLineDetail?.AccountRef?.name,
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.status(200).send({ message: "Journal Entries saved successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).send({ error: "Failed to save journal entries" });
  } finally {
    client.release();
  }
});

// Journal Report API
router.post("/journal-report", async (req, res) => {
  try {
    const report = req.body;
    const reportDate =
      report.Header.Option.find((opt) => opt.Name === "report_date")?.Value ||
      report.Header.EndPeriod;

    if (!reportDate)
      return res.status(400).json({ message: "Report date missing" });

    const rows = report.Rows.Row;
    const insertPromises = [];

    const processRow = (row) => {
      // Recursively process nested Rows if exist
      if (row.Rows && row.Rows.Row) {
        row.Rows.Row.forEach((nestedRow) => processRow(nestedRow));
      }

      // Process main ColData
      if (row.ColData) {
        const col = row.ColData;

        const tx_date_raw = col[0]?.value || null;
        // Convert invalid dates to null
        const tx_date = !tx_date_raw || tx_date_raw === "0-00-00" || isNaN(Date.parse(tx_date_raw))
          ? null
          : tx_date_raw;

        const txn_type = col[1]?.value || null;
        const doc_num = col[2]?.value || null;
        const name = col[3]?.value || null;
        const memo = col[4]?.value || null;
        const account_name = col[5]?.value || null;
        const debit = parseFloat(col[6]?.value) || 0;
        const credit = parseFloat(col[7]?.value) || 0;

        insertPromises.push(
          pool.query(
            `INSERT INTO journal_report 
             (report_date, tx_date, txn_type, doc_num, name, memo, account_name, debit, credit)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT(report_date, tx_date, txn_type, doc_num, account_name) 
             DO UPDATE SET 
             debit = EXCLUDED.debit, 
             credit = EXCLUDED.credit, 
             name = EXCLUDED.name, 
             memo = EXCLUDED.memo`,
            [reportDate, tx_date, txn_type, doc_num, name, memo, account_name, debit, credit]
          )
        );
      }

      // Process Summary if exists
      if (row.Summary && row.Summary.ColData) {
        const col = row.Summary.ColData;
        const debit = parseFloat(col[6]?.value) || 0;
        const credit = parseFloat(col[7]?.value) || 0;
        insertPromises.push(
          pool.query(
            `INSERT INTO journal_report_summary 
             (report_date, total_debit, total_credit)
             VALUES ($1,$2,$3)
             ON CONFLICT(report_date) DO UPDATE SET
             total_debit = EXCLUDED.total_debit,
             total_credit = EXCLUDED.total_credit`,
            [reportDate, debit, credit]
          )
        );
      }
    };

    rows.forEach((row) => processRow(row));
    await Promise.all(insertPromises);

    res.json({ message: "Journal Report saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

module.exports = router;
