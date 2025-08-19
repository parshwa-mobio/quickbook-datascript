const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db"); // pg connection pool

const app = express();
app.use(bodyParser.json());

app.post("/inventory-valuation-detail", async (req, res) => {
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

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
