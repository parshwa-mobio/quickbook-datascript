const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post("/save-inventory-adjustments", async (req, res) => {
  const inventoryData = req.body;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const adj of inventoryData) {
      // Insert or update main inventory adjustment
      const { rows } = await client.query(
        `
        INSERT INTO inventory_adjustments (
          qb_id, sync_token, adjust_account_value, adjust_account_name,
          domain, sparse, doc_number, txn_date, private_note,
          metadata_create_time, metadata_last_updated_time, metadata_last_modified_by_ref
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (qb_id) DO UPDATE SET
          sync_token = EXCLUDED.sync_token,
          adjust_account_value = EXCLUDED.adjust_account_value,
          adjust_account_name = EXCLUDED.adjust_account_name,
          domain = EXCLUDED.domain,
          sparse = EXCLUDED.sparse,
          doc_number = EXCLUDED.doc_number,
          txn_date = EXCLUDED.txn_date,
          private_note = EXCLUDED.private_note,
          metadata_create_time = EXCLUDED.metadata_create_time,
          metadata_last_updated_time = EXCLUDED.metadata_last_updated_time,
          metadata_last_modified_by_ref = EXCLUDED.metadata_last_modified_by_ref
        RETURNING id
        `,
        [
          adj.Id || null,
          adj.SyncToken || null,
          adj.AdjustAccountRef?.value || null,
          adj.AdjustAccountRef?.name || null,
          adj.domain || null,
          adj.sparse || false,
          adj.DocNumber || null,
          adj.TxnDate || null,
          adj.PrivateNote || null,
          adj.MetaData?.CreateTime || null,
          adj.MetaData?.LastUpdatedTime || null,
          adj.MetaData?.LastModifiedByRef?.value || null,
        ]
      );

      const adjustmentId = rows[0].id;

      // Remove existing lines for this adjustment
      await client.query(
        `DELETE FROM inventory_adjustment_lines WHERE inventory_adjustment_id = $1`,
        [adjustmentId]
      );

      // Insert line items
      for (const line of adj.Line || []) {
        await client.query(
          `
          INSERT INTO inventory_adjustment_lines (
            inventory_adjustment_id, line_id, detail_type, item_ref_value, item_ref_name, qty_diff
          )
          VALUES ($1,$2,$3,$4,$5,$6)
          `,
          [
            adjustmentId,
            line.Id || null,
            line.DetailType || null,
            line.ItemAdjustmentLineDetail?.ItemRef?.value || null,
            line.ItemAdjustmentLineDetail?.ItemRef?.name || null,
            line.ItemAdjustmentLineDetail?.QtyDiff || null,
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.status(200).json({ message: "Inventory adjustments saved successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving inventory adjustments:", error);
    res.status(500).json({ error: "Failed to save inventory adjustments" });
  } finally {
    client.release();
  }
});


app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
