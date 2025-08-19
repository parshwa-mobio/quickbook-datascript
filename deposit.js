const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
app.use(bodyParser.json());

app.post("/save-deposits", async (req, res) => {
  const deposits = req.body;
  const db = await pool.connect();
  try {
    for (const dep of deposits) {
      // Upsert into deposits table
      await db.query(
        `INSERT INTO deposits (
          id, deposit_to_account_ref_value, deposit_to_account_ref_name,
          cashback_account_ref_value, cashback_account_ref_name, cashback_amount, cashback_memo,
          total_amt, domain, sparse, sync_token,
          create_time, last_updated_time, txn_date,
          currency_ref_value, currency_ref_name, private_note
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
        )
        ON CONFLICT (id) DO UPDATE SET
          deposit_to_account_ref_value = EXCLUDED.deposit_to_account_ref_value,
          deposit_to_account_ref_name = EXCLUDED.deposit_to_account_ref_name,
          cashback_account_ref_value = EXCLUDED.cashback_account_ref_value,
          cashback_account_ref_name = EXCLUDED.cashback_account_ref_name,
          cashback_amount = EXCLUDED.cashback_amount,
          cashback_memo = EXCLUDED.cashback_memo,
          total_amt = EXCLUDED.total_amt,
          domain = EXCLUDED.domain,
          sparse = EXCLUDED.sparse,
          sync_token = EXCLUDED.sync_token,
          create_time = EXCLUDED.create_time,
          last_updated_time = EXCLUDED.last_updated_time,
          txn_date = EXCLUDED.txn_date,
          currency_ref_value = EXCLUDED.currency_ref_value,
          currency_ref_name = EXCLUDED.currency_ref_name,
          private_note = EXCLUDED.private_note`,
        [
          dep.Id,
          dep.DepositToAccountRef?.value || null,
          dep.DepositToAccountRef?.name || null,
          dep.CashBack?.AccountRef?.value || null,
          dep.CashBack?.AccountRef?.name || null,
          dep.CashBack?.Amount || null,
          dep.CashBack?.Memo || null,
          dep.TotalAmt,
          dep.domain || null,
          dep.sparse || false,
          dep.SyncToken || null,
          dep.MetaData?.CreateTime || null,
          dep.MetaData?.LastUpdatedTime || null,
          dep.TxnDate || null,
          dep.CurrencyRef?.value || null,
          dep.CurrencyRef?.name || null,
          dep.PrivateNote || null,
        ]
      );

      // Remove old lines for this deposit
      await db.query(`DELETE FROM deposit_lines WHERE deposit_id = $1`, [
        dep.Id,
      ]);

      // Insert lines
      for (const line of dep.Line || []) {
        const lineResult = await db.query(
          `INSERT INTO deposit_lines (
            deposit_id, line_id, line_num, amount, detail_type,
            deposit_line_detail_payment_method_ref_value, deposit_line_detail_check_num,
            deposit_line_detail_account_ref_value, deposit_line_detail_account_ref_name
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          RETURNING id`,
          [
            dep.Id,
            line.Id || null,
            line.LineNum || null,
            line.Amount || null,
            line.DetailType || null,
            line.DepositLineDetail?.PaymentMethodRef?.value || null,
            line.DepositLineDetail?.CheckNum || null,
            line.DepositLineDetail?.AccountRef?.value || null,
            line.DepositLineDetail?.AccountRef?.name || null,
          ]
        );

        const depositLineId = lineResult.rows[0].id;

        // Insert linked transactions
        for (const linked of line.LinkedTxn || []) {
          await db.query(
            `INSERT INTO deposit_linked_txns (
              deposit_line_id, txn_id, txn_type, txn_line_id
            ) VALUES ($1,$2,$3,$4)`,
            [
              depositLineId,
              linked.TxnId || null,
              linked.TxnType || null,
              linked.TxnLineId || null,
            ]
          );
        }
      }
    }

    res.status(200).json({ message: "Deposits upserted successfully" });
  } catch (err) {
    console.error("Error upserting deposits:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
