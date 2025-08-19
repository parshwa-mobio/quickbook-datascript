const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

// Save TaxClassification data
app.post("/tax-agencies", async (req, res) => {
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
    console.error("Error saving tax classifications:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
