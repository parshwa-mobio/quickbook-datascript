const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const router = express.Router();
router.use(bodyParser.json({ limit: "50mb" }));
router.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Tax Agencies API
router.post("/tax-agencies", async (req, res) => {
  const agencies = req.body.QueryResponse?.TaxAgency || [];
  const results = [];
  const client = await pool.connect();
  try {
    for (const agency of agencies) {
      const query = `
        INSERT INTO tax_agencies (
          qb_id, display_name, tax_tracked_on_purchases, tax_tracked_on_sales,
          tax_agency_config, domain, sparse, sync_token, create_time, last_updated_time
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
        )
        ON CONFLICT (qb_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          tax_tracked_on_purchases = EXCLUDED.tax_tracked_on_purchases,
          tax_tracked_on_sales = EXCLUDED.tax_tracked_on_sales,
          tax_agency_config = EXCLUDED.tax_agency_config,
          domain = EXCLUDED.domain,
          sparse = EXCLUDED.sparse,
          sync_token = EXCLUDED.sync_token,
          create_time = EXCLUDED.create_time,
          last_updated_time = EXCLUDED.last_updated_time
        RETURNING id;
      `;

      const values = [
        agency.Id,
        agency.DisplayName,
        agency.TaxTrackedOnPurchases,
        agency.TaxTrackedOnSales,
        agency.TaxAgencyConfig,
        agency.domain,
        agency.sparse,
        agency.SyncToken,
        agency.MetaData?.CreateTime
          ? new Date(agency.MetaData.CreateTime)
          : null,
        agency.MetaData?.LastUpdatedTime
          ? new Date(agency.MetaData.LastUpdatedTime)
          : null,
      ];

      const { rows } = await client.query(query, values);
      results.push({ qb_id: agency.Id, id: rows[0].id });
    }

    res.json({ message: "Tax Agencies saved successfully", results });
  } catch (error) {
    console.error("Error saving tax agencies:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Tax Classifications API
router.post("/tax-classifications", async (req, res) => {
  const client = await pool.connect();
  try {
    const { TaxClassification } = req.body.QueryResponse;

    for (const classification of TaxClassification) {
      const {
        Code,
        Name,
        Description,
        Level,
        ParentRef,
        ApplicableTo
      } = classification;

      // Insert into tax_classifications
      const result = await client.query(
        `INSERT INTO tax_classifications 
          (code, name, description, level, parent_ref_value, parent_ref_name)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE 
           SET name = EXCLUDED.name,
               description = EXCLUDED.description,
               level = EXCLUDED.level,
               parent_ref_value = EXCLUDED.parent_ref_value,
               parent_ref_name = EXCLUDED.parent_ref_name
         RETURNING id`,
        [
          Code,
          Name,
          Description,
          Level,
          ParentRef?.value || null,
          ParentRef?.name || null,
        ]
      );

      const classificationId = result.rows[0].id;

      // Clean old ApplicableTo before inserting new
      await client.query(
        `DELETE FROM tax_classification_applicable_to WHERE classification_id = $1`,
        [classificationId]
      );

      if (Array.isArray(ApplicableTo)) {
        for (const type of ApplicableTo) {
          await client.query(
            `INSERT INTO tax_classification_applicable_to (classification_id, applicable_type)
             VALUES ($1, $2)`,
            [classificationId, type]
          );
        }
      }
    }

    res.json({ message: "Tax classifications saved successfully" });
  } catch (error) {
    console.error("Error saving tax classifications:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Tax Codes API
router.post("/tax-codes", async (req, res) => {
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

// Tax Rates API
router.post("/tax-rates", async (req, res) => {
  const db = await pool.connect();
  const { QueryResponse } = req.body;
  const taxRates = QueryResponse?.TaxRate || [];

  try {
    for (const tr of taxRates) {
      const {
        Id,
        Name,
        Description,
        Active,
        RateValue,
        AgencyRef,
        SpecialTaxType,
        DisplayType,
        domain,
        sparse,
        SyncToken,
        MetaData,
      } = tr;

      await db.query(
        `INSERT INTO tax_rates 
          (qb_id, name, description, active, rate_value, agency_ref_value, special_tax_type, display_type, domain, sparse, sync_token, create_time, last_updated_time) 
         VALUES 
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (qb_id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            active = EXCLUDED.active,
            rate_value = EXCLUDED.rate_value,
            agency_ref_value = EXCLUDED.agency_ref_value,
            special_tax_type = EXCLUDED.special_tax_type,
            display_type = EXCLUDED.display_type,
            domain = EXCLUDED.domain,
            sparse = EXCLUDED.sparse,
            sync_token = EXCLUDED.sync_token,
            create_time = EXCLUDED.create_time,
            last_updated_time = EXCLUDED.last_updated_time`,
        [
          Id,
          Name,
          Description,
          Active,
          RateValue,
          AgencyRef?.value || null,
          SpecialTaxType,
          DisplayType,
          domain,
          sparse,
          SyncToken,
          MetaData?.CreateTime || null,
          MetaData?.LastUpdatedTime || null,
        ]
      );
    }

    res.status(200).send({ message: "Tax Rates saved successfully" });
  } catch (err) {
    console.error("Error inserting Tax Rates:", err);
    res.status(500).send({ error: "Database insert failed" });
  } finally {
    db.release();
  }
});

module.exports = router;
