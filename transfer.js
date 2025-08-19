const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const router = express.Router();
router.use(bodyParser.json());

router.post("/transfer", async (req, res) => {
  const transfers = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Table already exists - transfers

    for (const transfer of transfers) {
      await client.query(
        `INSERT INTO transfers (
              qb_transfer_id, sync_token, from_account_id, from_account_name,
              to_account_id, to_account_name, amount, domain, sparse, txn_date,
              currency_code, currency_name, create_time, last_updated_time,
              transfer_type, description, memo, exchange_rate, from_account_ref,
              to_account_ref, currency_ref, metadata
          )
          VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16, $17, $18, $19,
              $20, $21, $22
          )
          ON CONFLICT (qb_transfer_id) DO UPDATE SET
              sync_token = EXCLUDED.sync_token,
              amount = EXCLUDED.amount,
              last_updated_time = EXCLUDED.last_updated_time,
              metadata = EXCLUDED.metadata`,
        [
          transfer.Id,
          transfer.SyncToken || null,
          transfer.FromAccountRef?.value || null,
          transfer.FromAccountRef?.name || null,
          transfer.ToAccountRef?.value || null,
          transfer.ToAccountRef?.name || null,
          transfer.Amount || 0,
          transfer.domain || null,
          transfer.sparse || false,
          transfer.TxnDate || null,
          transfer.CurrencyRef?.value || null,
          transfer.CurrencyRef?.name || null,
          transfer.MetaData?.CreateTime || null,
          transfer.MetaData?.LastUpdatedTime || null,
          'Internal Transfer',
          transfer.Description || null,
          transfer.Memo || null,
          transfer.ExchangeRate || null,
          JSON.stringify(transfer.FromAccountRef || null),
          JSON.stringify(transfer.ToAccountRef || null),
          JSON.stringify(transfer.CurrencyRef || null),
          JSON.stringify(transfer.MetaData || null)
        ]
      );
    }

    await client.query("COMMIT");
    res.status(200).send({ message: "transfers saved successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).send({ error: "Failed to save transfers" });
  } finally {
    client.release();
  }
});

module.exports = router;
