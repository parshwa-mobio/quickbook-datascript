const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const router = express.Router();
router.use(bodyParser.json());

// Save Payment Methods API
router.post("/save-payment-methods", async (req, res) => {
  const paymentMethods = req.body;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const method of paymentMethods) {
      await client.query(
        `
        INSERT INTO payment_methods (
          qb_id,
          name,
          active,
          type,
          domain,
          sparse,
          sync_token,
          metadata_create_time,
          metadata_last_updated_time
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (qb_id) DO UPDATE SET
          name = EXCLUDED.name,
          active = EXCLUDED.active,
          type = EXCLUDED.type,
          domain = EXCLUDED.domain,
          sparse = EXCLUDED.sparse,
          sync_token = EXCLUDED.sync_token,
          metadata_create_time = EXCLUDED.metadata_create_time,
          metadata_last_updated_time = EXCLUDED.metadata_last_updated_time
        `,
        [
          method.Id || null,
          method.Name || null,
          method.Active ?? null,
          method.Type || null,
          method.domain || null,
          method.sparse ?? null,
          method.SyncToken || null,
          method.MetaData?.CreateTime || null,
          method.MetaData?.LastUpdatedTime || null
        ]
      );
    }

    await client.query("COMMIT");
    res.status(200).json({ message: "Payment methods saved successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving payment methods:", error);
    res.status(500).json({ error: "Failed to save payment methods" });
  } finally {
    client.release();
  }
});

// Save Payment API
router.post("/save-payment", async (req, res) => {
  const responseData = req.body;
  const payments = responseData.Payment;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const p of payments) {
      // Insert into payments table
      await client.query(
        `INSERT INTO payments (
          id, customer_ref_value, customer_ref_name,
          deposit_to_account_ref_value, total_amt, unapplied_amt,
          process_payment, domain, sparse, sync_token,
          create_time, last_updated_time, txn_date,
          currency_ref_value, currency_ref_name
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO NOTHING`,
        [
          p.Id,
          p.CustomerRef?.value || null,
          p.CustomerRef?.name || null,
          p.DepositToAccountRef?.value || null,
          p.TotalAmt || null,
          p.UnappliedAmt || null,
          p.ProcessPayment || false,
          p.domain || null,
          p.sparse || false,
          p.SyncToken || null,
          p.MetaData?.CreateTime ? new Date(p.MetaData.CreateTime) : null,
          p.MetaData?.LastUpdatedTime
            ? new Date(p.MetaData.LastUpdatedTime)
            : null,
          p.TxnDate || null,
          p.CurrencyRef?.value || null,
          p.CurrencyRef?.name || null,
        ]
      );

      // Top-level LinkedTxn
      if (Array.isArray(p.LinkedTxn)) {
        for (const lt of p.LinkedTxn) {
          await client.query(
            `INSERT INTO payment_linked_txns (payment_id, txn_id, txn_type)
             VALUES ($1,$2,$3)`,
            [p.Id, lt.TxnId || null, lt.TxnType || null]
          );
        }
      }

      // Line items
      if (Array.isArray(p.Line)) {
        for (const line of p.Line) {
          const lineRes = await client.query(
            `INSERT INTO payment_lines (payment_id, amount)
             VALUES ($1,$2) RETURNING id`,
            [p.Id, line.Amount || null]
          );
          const lineId = lineRes.rows[0].id;

          // LinkedTxn inside each line
          if (Array.isArray(line.LinkedTxn)) {
            for (const lt of line.LinkedTxn) {
              await client.query(
                `INSERT INTO payment_line_linked_txns (line_id, txn_id, txn_type)
                 VALUES ($1,$2,$3)`,
                [lineId, lt.TxnId || null, lt.TxnType || null]
              );
            }
          }

          // LineEx.any[]
          if (line.LineEx?.any && Array.isArray(line.LineEx.any)) {
            for (const anyItem of line.LineEx.any) {
              await client.query(
                `INSERT INTO payment_line_extras (line_id, name, value)
                 VALUES ($1,$2,$3)`,
                [
                  lineId,
                  anyItem.value?.Name || null,
                  anyItem.value?.Value || null,
                ]
              );
            }
          }
        }
      }
    }

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
