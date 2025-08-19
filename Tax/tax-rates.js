const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post("/tax-rates", async (req, res) => {
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

      await pool.query(
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
