const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const router = express.Router();
router.use(bodyParser.json());

// Save Inventory Adjustments API
router.post("/save-inventory-adjustments", async (req, res) => {
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

// Inventory Valuation Detail API
router.post("/inventory-valuation-detail", async (req, res) => {
  const client = await pool.connect();
  try {
    const report = req.body;
    const insertPromises = [];

    // Recursive row processor
    const processRow = (row) => {
      // Handle ColData rows
      if (row.ColData) {
        const col = row.ColData;
        insertPromises.push(
          client.query(
            `INSERT INTO inventory_valuation_detail
              (item_name, txn_date, txn_type, doc_num, name,
               qty, rate, inventory_cost, qty_on_hand, asset_value, row_type)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              col[0]?.value || null, // item_name
              col[1]?.value || null, // txn_date ("Beginning Balance" or date)
              col[2]?.value || null, // txn_type
              col[3]?.value || null, // doc_num
              col[4]?.value || null, // name
              col[5]?.value ? Number(col[5].value) : null, // qty
              col[6]?.value ? Number(col[6].value) : null, // rate
              col[7]?.value ? Number(col[7].value) : null, // inventory_cost
              col[8]?.value ? Number(col[8].value) : null, // qty_on_hand
              col[9]?.value ? Number(col[9].value) : null, // asset_value
              row.type || "Data", // row_type
            ]
          )
        );
      }

      // Handle nested Rows
      if (row.Rows?.Row) {
        row.Rows.Row.forEach((nestedRow) => processRow(nestedRow));
      }

      // Handle Summary rows
      if (row.Summary?.ColData) {
        const col = row.Summary.ColData;
        insertPromises.push(
          client.query(
            `INSERT INTO inventory_valuation_detail
              (item_name, txn_date, txn_type, doc_num, name,
               qty, rate, inventory_cost, qty_on_hand, asset_value, row_type)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              col[0]?.value || null, // item_name (summary label)
              null, // txn_date not relevant for summary
              null, // txn_type
              null, // doc_num
              null, // name
              col[5]?.value ? Number(col[5].value) : null, // qty
              col[6]?.value ? Number(col[6].value) : null, // rate
              col[7]?.value ? Number(col[7].value) : null, // inventory_cost
              col[8]?.value ? Number(col[8].value) : null, // qty_on_hand
              col[9]?.value ? Number(col[9].value) : null, // asset_value
              "Summary",
            ]
          )
        );
      }
    };

    // Start transaction
    await client.query("BEGIN");

    if (report.Rows?.Row) {
      report.Rows.Row.forEach((row) => processRow(row));
    }

    await Promise.all(insertPromises);
    await client.query("COMMIT");

    res.json({ message: "Inventory Valuation Detail saved successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving Inventory Valuation Detail:", error);
    res.status(500).json({ error: "Failed to save Inventory Valuation Detail" });
  } finally {
    client.release();
  }
});

// Inventory Valuation Summary API
router.post("/inventory-valuation-summary", async (req, res) => {
  const client = await pool.connect();
  try {
    const report = req.body;
    const insertPromises = [];

    const processRow = (row) => {
      if (row.ColData) {
        const col = row.ColData;
        insertPromises.push(
          client.query(
            `INSERT INTO inventory_valuation_summary
              (item_name, item_id, sku, qty, asset_value, avg_cost, row_group)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              col[0]?.value || null, // item_name
              col[0]?.id || null,    // item_id
              col[1]?.value || null, // SKU
              col[2]?.value ? Number(col[2].value) : null, // qty
              col[3]?.value ? Number(col[3].value) : null, // asset_value
              col[4]?.value ? Number(col[4].value) : null, // avg_cost
              row.group || "Data"    // row_group
            ]
          )
        );
      }
    };

    // Transaction
    await client.query("BEGIN");
    if (report.Rows?.Row) {
      report.Rows.Row.forEach((row) => processRow(row));
    }
    await Promise.all(insertPromises);
    await client.query("COMMIT");

    res.json({ message: "Inventory Valuation Summary saved successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving Inventory Valuation Summary:", error);
    res.status(500).json({ error: "Failed to save Inventory Valuation Summary" });
  } finally {
    client.release();
  }
});

module.exports = router;
