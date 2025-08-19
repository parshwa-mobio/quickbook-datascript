const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db"); // your pg connection pool

const app = express();
app.use(bodyParser.json());

app.post("/save-purchase-orders", async (req, res) => {
  try {
    const purchaseOrders = req.body;
    // console.log(purchaseOrders);
    const client = await pool.connect();

    for (const po of purchaseOrders) {
      // Insert main purchase_order
      const poResult = await client.query(
        `INSERT INTO purchase_order 
        (qb_id, sync_token, domain, sparse, txn_date, doc_number, total_amt, 
         email_status, po_status, vendor_id, vendor_name, ap_account_id, ap_account_name, 
         currency_value, currency_name, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
        [
          po.Id,
          po.SyncToken,
          po.domain,
          po.sparse,
          po.TxnDate,
          po.DocNumber,
          po.TotalAmt,
          po.EmailStatus,
          po.POStatus,
          po.VendorRef?.value,
          po.VendorRef?.name,
          po.APAccountRef?.value,
          po.APAccountRef?.name,
          po.CurrencyRef?.value,
          po.CurrencyRef?.name,
          po.MetaData?.CreateTime,
          po.MetaData?.LastUpdatedTime,
        ]
      );

      const poId = poResult.rows[0].id;

      // Insert vendor address
      if (po.VendorAddr) {
        await client.query(
          `INSERT INTO purchase_order_vendor_addr 
          (purchase_order_id, line1, line2, line3, line4, lat, long)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            poId,
            po.VendorAddr.Line1,
            po.VendorAddr.Line2,
            po.VendorAddr.Line3,
            po.VendorAddr.Line4,
            po.VendorAddr.Lat,
            po.VendorAddr.Long,
          ]
        );
      }

      // Insert shipping address
      if (po.ShipAddr) {
        await client.query(
          `INSERT INTO purchase_order_ship_addr 
          (purchase_order_id, line1, line2, line3, lat, long)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            poId,
            po.ShipAddr.Line1,
            po.ShipAddr.Line2,
            po.ShipAddr.Line3,
            po.ShipAddr.Lat,
            po.ShipAddr.Long,
          ]
        );
      }

      // Insert linked transactions
      if (po.LinkedTxn && po.LinkedTxn.length) {
        for (const txn of po.LinkedTxn) {
          await client.query(
            `INSERT INTO purchase_order_linked_txn 
            (purchase_order_id, txn_id, txn_type) VALUES ($1,$2,$3)`,
            [poId, txn.TxnId, txn.TxnType]
          );
        }
      }

      // Insert lines
      if (po.Line && po.Line.length) {
        for (const line of po.Line) {
          await client.query(
            `INSERT INTO purchase_order_lines 
            (purchase_order_id, line_id, line_num, description, amount, detail_type, unit_price, qty, 
             billable_status, item_id, item_name, customer_id, customer_name, tax_code_ref)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [
              poId,
              line.Id,
              line.LineNum,
              line.Description,
              line.Amount,
              line.DetailType,
              line.ItemBasedExpenseLineDetail?.UnitPrice || null,
              line.ItemBasedExpenseLineDetail?.Qty || null,
              line.ItemBasedExpenseLineDetail?.BillableStatus || null,
              line.ItemBasedExpenseLineDetail?.ItemRef?.value || null,
              line.ItemBasedExpenseLineDetail?.ItemRef?.name || null,
              line.ItemBasedExpenseLineDetail?.CustomerRef?.value || null,
              line.ItemBasedExpenseLineDetail?.CustomerRef?.name || null,
              line.ItemBasedExpenseLineDetail?.TaxCodeRef?.value || null,
            ]
          );
        }
      }
    }

    res.status(201).json({ message: "Purchase orders saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
