const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
app.use(bodyParser.json());

app.post("/save-vendor", async (req, res) => {
  const vendors = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const vendor of vendors) {
      await client.query(
        `INSERT INTO vendors (
              qb_vendor_id, sync_token, display_name, company_name, given_name, family_name,
              print_on_check_name, active, vendor_1099, balance, acct_num, bill_rate,
              currency_ref, bill_addr, term_ref, primary_phone, mobile, fax,
              primary_email_addr, web_addr, v4id_pseudonym, metadata
          )
          VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10, $11, $12,
              $13, $14, $15, $16, $17, $18,
              $19, $20, $21, $22
          )
          ON CONFLICT (qb_vendor_id) DO UPDATE SET
              display_name = EXCLUDED.display_name,
              company_name = EXCLUDED.company_name,
              balance = EXCLUDED.balance,
              metadata = EXCLUDED.metadata`,
        [
          vendor.Id,
          vendor.SyncToken || null,
          vendor.DisplayName || null,
          vendor.CompanyName || null,
          vendor.GivenName || null,
          vendor.FamilyName || null,
          vendor.PrintOnCheckName || null,
          vendor.Active || false,
          vendor.Vendor1099 || false,
          vendor.Balance || 0,
          vendor.AcctNum || null,
          vendor.BillRate || null,
          vendor.CurrencyRef || null,
          vendor.BillAddr || null,
          vendor.TermRef || null,
          vendor.PrimaryPhone || null,
          vendor.Mobile || null,
          vendor.Fax || null,
          vendor.PrimaryEmailAddr || null,
          vendor.WebAddr || null,
          vendor.V4IDPseudonym || null,
          vendor.MetaData || null,
        ]
      );
    }

    await client.query("COMMIT");
    res.status(200).send({ message: "vendors saved successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).send({ error: "Failed to save vendors" });
  } finally {
    client.release();
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
