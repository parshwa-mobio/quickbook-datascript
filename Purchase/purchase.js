const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db"); // your pg connection pool

const app = express();
app.use(bodyParser.json());

app.post("/save-purchases", async (req, res) => {
  const client = await pool.connect();
  const purchases = req.body;

  try {
    await client.query("BEGIN");

    for (const purchase of purchases) {
      // Insert main purchase record
      const purchaseResult = await client.query(
        `INSERT INTO purchase 
        (qb_id, sync_token, domain, sparse, txn_date, total_amt, payment_type, entity_id, entity_name, entity_type,
         account_id, account_name, currency_value, currency_name, private_note, doc_number,
         created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING id`,
        [
          purchase.Id,
          purchase.SyncToken,
          purchase.domain,
          purchase.sparse,
          purchase.TxnDate,
          purchase.TotalAmt,
          purchase.PaymentType || null,
          purchase.EntityRef?.value || null,
          purchase.EntityRef?.name || null,
          purchase.EntityRef?.type || null,
          purchase.AccountRef?.value || null,
          purchase.AccountRef?.name || null,
          purchase.CurrencyRef?.value || null,
          purchase.CurrencyRef?.name || null,
          purchase.PrivateNote || null,
          purchase.DocNumber || null,
          purchase.MetaData?.CreateTime,
          purchase.MetaData?.LastUpdatedTime
        ]
      );

      const purchaseId = purchaseResult.rows[0].id;

      // Insert PurchaseEx NameValue pairs
      if (purchase.PurchaseEx?.any) {
        for (const nv of purchase.PurchaseEx.any) {
          await client.query(
            `INSERT INTO purchase_ex (purchase_id, name, value)
             VALUES ($1, $2, $3)`,
            [
              purchaseId,
              nv.value?.Name || null,
              nv.value?.Value || null
            ]
          );
        }
      }

      // Insert Lines
      if (purchase.Line) {
        for (const line of purchase.Line) {
          const lineResult = await client.query(
            `INSERT INTO purchase_lines
            (purchase_id, line_id, amount, detail_type)
             VALUES ($1,$2,$3,$4)
             RETURNING id`,
            [
              purchaseId,
              line.Id,
              line.Amount,
              line.DetailType
            ]
          );

          const lineId = lineResult.rows[0].id;

          // Insert AccountBasedExpenseLineDetail if exists
          if (line.AccountBasedExpenseLineDetail) {
            await client.query(
              `INSERT INTO purchase_line_account_detail
              (line_id, account_id, account_name, billable_status, tax_code_ref)
               VALUES ($1,$2,$3,$4,$5)`,
              [
                lineId,
                line.AccountBasedExpenseLineDetail.AccountRef?.value || null,
                line.AccountBasedExpenseLineDetail.AccountRef?.name || null,
                line.AccountBasedExpenseLineDetail.BillableStatus || null,
                line.AccountBasedExpenseLineDetail.TaxCodeRef?.value || null
              ]
            );
          }
        }
      }
    }

    await client.query("COMMIT");
    res.status(201).json({ message: "Purchases saved successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error saving purchases:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});