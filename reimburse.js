const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db"); // pg connection

const app = express();
app.use(bodyParser.json());

app.post("/reimburse-charges", async (req, res) => {
  const client = await pool.connect();
  try {
    const { QueryResponse } = req.body;
    const reimburseCharges = QueryResponse?.ReimburseCharge || [];

    await client.query("BEGIN");

    for (const charge of reimburseCharges) {
      // Insert parent reimburse_charges
      await client.query(
        `INSERT INTO reimburse_charges (
          id, customer_id, customer_name, has_been_invoiced,
          amount, domain, sparse, sync_token, txn_date,
          currency_value, currency_name, private_note,
          created_time, last_updated_time
        ) VALUES (
          $1,$2,$3,$4,
          $5,$6,$7,$8,$9,
          $10,$11,$12,
          $13,$14
        )
        ON CONFLICT (id) DO NOTHING`,
        [
          charge.Id,
          charge.CustomerRef?.value || null,
          charge.CustomerRef?.name || null,
          charge.HasBeenInvoiced || false,
          charge.Amount || null,
          charge.domain || null,
          charge.sparse || null,
          charge.SyncToken || null,
          charge.TxnDate || null,
          charge.CurrencyRef?.value || null,
          charge.CurrencyRef?.name || null,
          charge.PrivateNote || null,
          charge.MetaData?.CreateTime || null,
          charge.MetaData?.LastUpdatedTime || null
        ]
      );

      // Insert linked transactions for parent
      for (const linked of charge.LinkedTxn || []) {
        await client.query(
          `INSERT INTO reimburse_charge_linked_txns (
            reimburse_charge_id, txn_id, txn_type
          ) VALUES ($1,$2,$3)`,
          [charge.Id, linked.TxnId, linked.TxnType]
        );
      }

      // Insert line items
      for (const line of charge.Line || []) {
        const lineResult = await client.query(
          `INSERT INTO reimburse_charge_lines (
            reimburse_charge_id, line_id, line_num, description,
            amount, detail_type, item_account_ref_id,
            item_account_ref_name, tax_code_ref
          ) VALUES (
            $1,$2,$3,$4,
            $5,$6,$7,$8,$9
          )
          RETURNING id`,
          [
            charge.Id,
            line.Id || null,
            line.LineNum || null,
            line.Description || null,
            line.Amount || null,
            line.DetailType || null,
            line.ReimburseLineDetail?.ItemAccountRef?.value || null,
            line.ReimburseLineDetail?.ItemAccountRef?.name || null,
            line.ReimburseLineDetail?.TaxCodeRef?.value || null
          ]
        );

        const lineId = lineResult.rows[0].id;

        // Insert linked transactions for this line
        for (const linked of line.LinkedTxn || []) {
          await client.query(
            `INSERT INTO reimburse_charge_line_linked_txns (
              line_id, txn_id, txn_type
            ) VALUES ($1,$2,$3)`,
            [lineId, linked.TxnId, linked.TxnType]
          );
        }
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Reimburse Charges saved successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving reimburse charges:", error);
    res.status(500).json({ error: "Failed to save reimburse charges" });
  } finally {
    client.release();
  }
});

app.listen(5000, () => {
  console.log("Reimburse Charges service running on port 5000");
});
