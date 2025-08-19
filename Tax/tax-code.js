const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post("/tax-codes", async (req, res) => {
  const taxCodeData = req.body.QueryResponse.TaxCode || [];
  const db = await pool.connect();

  try {
    await db.query("BEGIN");

    for (const taxCode of taxCodeData) {
      // Insert into tax_codes
      const taxCodeRes = await db.query(
        `INSERT INTO tax_codes 
          (qb_id, name, description, active, hidden, taxable, tax_group, 
           tax_code_config_type, domain, sparse, sync_token, create_time, last_updated_time) 
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (qb_id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            active = EXCLUDED.active,
            hidden = EXCLUDED.hidden,
            taxable = EXCLUDED.taxable,
            tax_group = EXCLUDED.tax_group,
            tax_code_config_type = EXCLUDED.tax_code_config_type,
            domain = EXCLUDED.domain,
            sparse = EXCLUDED.sparse,
            sync_token = EXCLUDED.sync_token,
            create_time = EXCLUDED.create_time,
            last_updated_time = EXCLUDED.last_updated_time
         RETURNING id`,
        [
          taxCode.Id,
          taxCode.Name,
          taxCode.Description || null,
          taxCode.Active ?? true,
          taxCode.Hidden ?? false,
          taxCode.Taxable ?? false,
          taxCode.TaxGroup ?? false,
          taxCode.TaxCodeConfigType || null,
          taxCode.domain || null,
          taxCode.sparse ?? null,
          taxCode.SyncToken || null,
          taxCode.MetaData?.CreateTime || null,
          taxCode.MetaData?.LastUpdatedTime || null,
        ]
      );
      const taxCodeId = taxCodeRes.rows[0].id;

      // Insert SalesTaxRateDetail (if exists)
      if (taxCode.SalesTaxRateList?.TaxRateDetail) {
        for (const detail of taxCode.SalesTaxRateList.TaxRateDetail) {
          await db.query(
            `INSERT INTO sales_tax_rate_details 
              (tax_code_id, tax_rate_ref_value, tax_rate_ref_name, tax_type_applicable, tax_order) 
             VALUES ($1,$2,$3,$4,$5)`,
            [
              taxCodeId,
              detail.TaxRateRef?.value || null,
              detail.TaxRateRef?.name || null,
              detail.TaxTypeApplicable || null,
              detail.TaxOrder ? parseInt(detail.TaxOrder) : null,
            ]
          );
        }
      }

      // Insert PurchaseTaxRateDetail (if exists)
      if (taxCode.PurchaseTaxRateList?.TaxRateDetail) {
        for (const detail of taxCode.PurchaseTaxRateList.TaxRateDetail) {
          await db.query(
            `INSERT INTO purchase_tax_rate_details 
              (tax_code_id, tax_rate_ref_value, tax_rate_ref_name, tax_type_applicable, tax_order) 
             VALUES ($1,$2,$3,$4,$5)`,
            [
              taxCodeId,
              detail.TaxRateRef?.value || null,
              detail.TaxRateRef?.name || null,
              detail.TaxTypeApplicable || null,
              detail.TaxOrder ? parseInt(detail.TaxOrder) : null,
            ]
          );
        }
      }
    }

    await db.query("COMMIT");
    res.status(200).send({ message: "TaxCodes saved successfully" });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Error inserting TaxCodes:", err);
    res.status(500).send({ error: "Database insert failed" });
  } finally {
    db.release();
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
