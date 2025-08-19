const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
app.use(bodyParser.json());

app.post("/save-journal-entry", async (req, res) => {
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

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
