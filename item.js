const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
app.use(bodyParser.json());

app.post("/save-items", async (req, res) => {
  const responseData = req.body;
  const items = responseData.Item;
  // console.log(items);
  const client = await pool.connect();
  try {
    try {
      await client.query("BEGIN");

      for (const item of items || []) {
        await client.query(
          `
                    INSERT INTO items (
                        id, name, description, active, fully_qualified_name, taxable,
                        unit_price, type, purchase_desc, purchase_cost, track_qty_on_hand,
                        qty_on_hand, inv_start_date, domain, sparse, sync_token,
                        create_time, last_updated_time
                    )
                    VALUES ($1, $2, $3, $4, $5, $6,
                            $7, $8, $9, $10, $11,
                            $12, $13, $14, $15, $16,
                            $17, $18)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        active = EXCLUDED.active,
                        fully_qualified_name = EXCLUDED.fully_qualified_name,
                        taxable = EXCLUDED.taxable,
                        unit_price = EXCLUDED.unit_price,
                        type = EXCLUDED.type,
                        purchase_desc = EXCLUDED.purchase_desc,
                        purchase_cost = EXCLUDED.purchase_cost,
                        track_qty_on_hand = EXCLUDED.track_qty_on_hand,
                        qty_on_hand = EXCLUDED.qty_on_hand,
                        inv_start_date = EXCLUDED.inv_start_date,
                        domain = EXCLUDED.domain,
                        sparse = EXCLUDED.sparse,
                        sync_token = EXCLUDED.sync_token,
                        create_time = EXCLUDED.create_time,
                        last_updated_time = EXCLUDED.last_updated_time
                `,
          [
            item.Id,
            item.Name || null,
            item.Description || null,
            item.Active || false,
            item.FullyQualifiedName || null,
            item.Taxable || false,
            item.UnitPrice || 0,
            item.Type || null,
            item.PurchaseDesc || null,
            item.PurchaseCost || 0,
            item.TrackQtyOnHand || false,
            item.QtyOnHand || null,
            item.InvStartDate || null,
            item.domain || null,
            item.sparse || false,
            item.SyncToken || null,
            item.MetaData?.CreateTime || null,
            item.MetaData?.LastUpdatedTime || null,
          ]
        );

        // IncomeAccountRef
        if (item.IncomeAccountRef) {
          await client.query(
            `
                        INSERT INTO item_account_refs (item_id, account_type, account_value, account_name)
                        VALUES ($1, 'Income', $2, $3)
                        ON CONFLICT (item_id, account_type) DO UPDATE SET
                            account_value = EXCLUDED.account_value,
                            account_name = EXCLUDED.account_name
                    `,
            [
              item.Id,
              item.IncomeAccountRef.value || null,
              item.IncomeAccountRef.name || null,
            ]
          );
        }

        // ExpenseAccountRef
        if (item.ExpenseAccountRef) {
          await client.query(
            `
                        INSERT INTO item_account_refs (item_id, account_type, account_value, account_name)
                        VALUES ($1, 'Expense', $2, $3)
                        ON CONFLICT (item_id, account_type) DO UPDATE SET
                            account_value = EXCLUDED.account_value,
                            account_name = EXCLUDED.account_name
                    `,
            [
              item.Id,
              item.ExpenseAccountRef.value || null,
              item.ExpenseAccountRef.name || null,
            ]
          );
        }

        // AssetAccountRef
        if (item.AssetAccountRef) {
          await client.query(
            `
                        INSERT INTO item_account_refs (item_id, account_type, account_value, account_name)
                        VALUES ($1, 'Asset', $2, $3)
                        ON CONFLICT (item_id, account_type) DO UPDATE SET
                            account_value = EXCLUDED.account_value,
                            account_name = EXCLUDED.account_name
                    `,
            [
              item.Id,
              item.AssetAccountRef.value || null,
              item.AssetAccountRef.name || null,
            ]
          );
        }
      }

      await client.query("COMMIT");
      res.send({ message: "Items and account references saved successfully." });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error saving items:", error);
      res.status(500).send({ error: "Error saving items." });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).send({ error: "Error fetching items." });
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
