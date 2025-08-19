const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db"); // pg connection pool

const app = express();
app.use(bodyParser.json());

app.post("/inventory-valuation-summary", async (req, res) => {
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

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
