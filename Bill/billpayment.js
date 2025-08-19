const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post("/save-bill-payments", async (req, res) => {
  const responseData = req.body;
  const billPayments = responseData.BillPayment || [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (let bp of billPayments) {
      // Insert or update bill payment
      await client.query(
        `INSERT INTO bill_payments (
          id, vendor_id, vendor_name, pay_type,
          cc_account_id, cc_account_name,
          bank_account_id, bank_account_name, print_status,
          total_amount, domain, sparse, sync_token, doc_number, txn_date,
          currency_code, currency_name,
          create_time, last_updated_time
        )
        VALUES (
          $1, $2, $3, $4,
          $5, $6,
          $7, $8, $9,
          $10, $11, $12, $13, $14, $15,
          $16, $17,
          $18, $19
        )
        ON CONFLICT (id) DO UPDATE
        SET vendor_id = EXCLUDED.vendor_id,
            vendor_name = EXCLUDED.vendor_name,
            pay_type = EXCLUDED.pay_type,
            cc_account_id = EXCLUDED.cc_account_id,
            cc_account_name = EXCLUDED.cc_account_name,
            bank_account_id = EXCLUDED.bank_account_id,
            bank_account_name = EXCLUDED.bank_account_name,
            print_status = EXCLUDED.print_status,
            total_amount = EXCLUDED.total_amount,
            domain = EXCLUDED.domain,
            sparse = EXCLUDED.sparse,
            sync_token = EXCLUDED.sync_token,
            doc_number = EXCLUDED.doc_number,
            txn_date = EXCLUDED.txn_date,
            currency_code = EXCLUDED.currency_code,
            currency_name = EXCLUDED.currency_name,
            create_time = EXCLUDED.create_time,
            last_updated_time = EXCLUDED.last_updated_time`,
        [
          bp.Id,
          bp.VendorRef?.value || null,
          bp.VendorRef?.name || null,
          bp.PayType || null,
          bp.CreditCardPayment?.CCAccountRef?.value || null,
          bp.CreditCardPayment?.CCAccountRef?.name || null,
          bp.CheckPayment?.BankAccountRef?.value || null,
          bp.CheckPayment?.BankAccountRef?.name || null,
          bp.CheckPayment?.PrintStatus || null,
          bp.TotalAmt || 0,
          bp.domain || null,
          bp.sparse || false,
          bp.SyncToken || null,
          bp.DocNumber || null,
          bp.TxnDate || null,
          bp.CurrencyRef?.value || null,
          bp.CurrencyRef?.name || null,
          bp.MetaData?.CreateTime ? new Date(bp.MetaData.CreateTime) : null,
          bp.MetaData?.LastUpdatedTime
            ? new Date(bp.MetaData.LastUpdatedTime)
            : null,
        ]
      );

      // Delete old lines for this payment (to avoid duplicates on update)
      await client.query(
        "DELETE FROM bill_payment_lines WHERE bill_payment_id = $1",
        [bp.Id]
      );

      // Insert payment lines
      if (bp.Line && Array.isArray(bp.Line)) {
        for (let line of bp.Line) {
          await client.query(
            `INSERT INTO bill_payment_lines (
              bill_payment_id, amount, linked_txn_id, linked_txn_type
            ) VALUES ($1, $2, $3, $4)`,
            [
              bp.Id,
              line.Amount || 0,
              line.LinkedTxn?.[0]?.TxnId || null,
              line.LinkedTxn?.[0]?.TxnType || null,
            ]
          );
        }
      }
    }

    await client.query("COMMIT");
    res.status(200).send({ message: "Bill Payments saved successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DB error:", err);
    res.status(500).send({ error: "DB insert failed" });
  } finally {
    client.release();
  }
});

app.listen(5001, () => {
  console.log("Bill Payments service running on port 5001");
});
