const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
app.use(bodyParser.json());

app.post("/save-expense", async (req, res) => {
  console.log(req.body);
  const purchases = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (let purchase of purchases) {
      // Extract PurchaseEx values
      let purchaseExName = null;
      let purchaseExValue = null;
      if (purchase.PurchaseEx?.any?.length) {
        purchaseExName = purchase.PurchaseEx.any[0]?.value?.Name || null;
        purchaseExValue = purchase.PurchaseEx.any[0]?.value?.Value || null;
      }

      // Insert into purchases table
      await client.query(
        `INSERT INTO purchases (
                    id, account_ref_id, account_ref_name, payment_type, credit, total_amt,
                    purchase_ex_name, purchase_ex_value, domain, sparse, sync_token,
                    txn_date, currency_ref_id, currency_ref_name, create_time, last_updated_time
                ) VALUES (
                    $1,$2,$3,$4,$5,$6,
                    $7,$8,$9,$10,$11,
                    $12,$13,$14,$15,$16
                )
                ON CONFLICT (id) DO UPDATE SET
                    account_ref_id = EXCLUDED.account_ref_id,
                    account_ref_name = EXCLUDED.account_ref_name,
                    payment_type = EXCLUDED.payment_type,
                    credit = EXCLUDED.credit,
                    total_amt = EXCLUDED.total_amt,
                    purchase_ex_name = EXCLUDED.purchase_ex_name,
                    purchase_ex_value = EXCLUDED.purchase_ex_value,
                    domain = EXCLUDED.domain,
                    sparse = EXCLUDED.sparse,
                    sync_token = EXCLUDED.sync_token,
                    txn_date = EXCLUDED.txn_date,
                    currency_ref_id = EXCLUDED.currency_ref_id,
                    currency_ref_name = EXCLUDED.currency_ref_name,
                    create_time = EXCLUDED.create_time,
                    last_updated_time = EXCLUDED.last_updated_time`,
        [
          purchase.Id,
          purchase.AccountRef?.value || null,
          purchase.AccountRef?.name || null,
          purchase.PaymentType || null,
          purchase.Credit ?? null,
          purchase.TotalAmt ?? 0,
          purchaseExName,
          purchaseExValue,
          purchase.domain || null,
          purchase.sparse ?? null,
          purchase.SyncToken || null,
          purchase.TxnDate || null,
          purchase.CurrencyRef?.value || null,
          purchase.CurrencyRef?.name || null,
          purchase.MetaData?.CreateTime
            ? new Date(purchase.MetaData.CreateTime)
            : null,
          purchase.MetaData?.LastUpdatedTime
            ? new Date(purchase.MetaData.LastUpdatedTime)
            : null,
        ]
      );

      // Insert line items
      if (Array.isArray(purchase.Line)) {
        for (let line of purchase.Line) {
          await client.query(
            `INSERT INTO purchase_lines (
                            purchase_id, line_id, amount, detail_type,
                            account_ref_id, account_ref_name, billable_status, tax_code_ref_id
                        ) VALUES (
                            $1,$2,$3,$4,
                            $5,$6,$7,$8
                        )
                        ON CONFLICT (purchase_id, line_id) DO UPDATE SET
                            amount = EXCLUDED.amount,
                            detail_type = EXCLUDED.detail_type,
                            account_ref_id = EXCLUDED.account_ref_id,
                            account_ref_name = EXCLUDED.account_ref_name,
                            billable_status = EXCLUDED.billable_status,
                            tax_code_ref_id = EXCLUDED.tax_code_ref_id`,
            [
              purchase.Id,
              line.Id || null,
              line.Amount ?? 0,
              line.DetailType || null,
              line.AccountBasedExpenseLineDetail?.AccountRef?.value || null,
              line.AccountBasedExpenseLineDetail?.AccountRef?.name || null,
              line.AccountBasedExpenseLineDetail?.BillableStatus || null,
              line.AccountBasedExpenseLineDetail?.TaxCodeRef?.value || null,
            ]
          );
        }
      }
    }

    await client.query("COMMIT");
    res.status(200).send({ message: "Purchases saved successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error inserting purchases:", err);
    res.status(500).send({ error: "Database insert failed" });
  } finally {
    client.release();
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
