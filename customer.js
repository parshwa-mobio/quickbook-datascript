const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const router = express.Router();
router.use(bodyParser.json());

router.post("/", async (req, res) => {
  const customers = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    for (let customer of customers) {
      await client.query(
        `INSERT INTO customers (
                    id, given_name, family_name, company_name, display_name, email, phone, taxable, balance,
                    currency_code, currency_name, preferred_delivery_method, active, create_time, last_updated_time,
                    bill_id, bill_line1, bill_city, bill_state, bill_postal_code, bill_lat, bill_long,
                    ship_id, ship_line1, ship_city, ship_state, ship_postal_code, ship_lat, ship_long
                )
                VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,
                    $10,$11,$12,$13,$14,$15,
                    $16,$17,$18,$19,$20,$21,$22,
                    $23,$24,$25,$26,$27,$28,$29
                )
                ON CONFLICT (id) DO UPDATE
                SET given_name = EXCLUDED.given_name,
                    family_name = EXCLUDED.family_name,
                    company_name = EXCLUDED.company_name,
                    display_name = EXCLUDED.display_name,
                    email = EXCLUDED.email,
                    phone = EXCLUDED.phone,
                    taxable = EXCLUDED.taxable,
                    balance = EXCLUDED.balance,
                    currency_code = EXCLUDED.currency_code,
                    currency_name = EXCLUDED.currency_name,
                    preferred_delivery_method = EXCLUDED.preferred_delivery_method,
                    active = EXCLUDED.active,
                    create_time = EXCLUDED.create_time,
                    last_updated_time = EXCLUDED.last_updated_time,
                    bill_id = EXCLUDED.bill_id,
                    bill_line1 = EXCLUDED.bill_line1,
                    bill_city = EXCLUDED.bill_city,
                    bill_state = EXCLUDED.bill_state,
                    bill_postal_code = EXCLUDED.bill_postal_code,
                    bill_lat = EXCLUDED.bill_lat,
                    bill_long = EXCLUDED.bill_long,
                    ship_id = EXCLUDED.ship_id,
                    ship_line1 = EXCLUDED.ship_line1,
                    ship_city = EXCLUDED.ship_city,
                    ship_state = EXCLUDED.ship_state,
                    ship_postal_code = EXCLUDED.ship_postal_code,
                    ship_lat = EXCLUDED.ship_lat,
                    ship_long = EXCLUDED.ship_long`,
        [
          customer.Id,
          customer.GivenName || null,
          customer.FamilyName || null,
          customer.CompanyName || null,
          customer.DisplayName || null,
          customer.PrimaryEmailAddr?.Address || null,
          customer.PrimaryPhone?.FreeFormNumber || null,
          customer.Taxable || false,
          customer.Balance || 0,
          customer.CurrencyRef?.value || null,
          customer.CurrencyRef?.name || null,
          customer.PreferredDeliveryMethod || null,
          customer.Active || false,
          customer.MetaData?.CreateTime
            ? new Date(customer.MetaData.CreateTime)
            : null,
          customer.MetaData?.LastUpdatedTime
            ? new Date(customer.MetaData.LastUpdatedTime)
            : null,

          // Billing
          customer.BillAddr?.Id || null,
          customer.BillAddr?.Line1 || null,
          customer.BillAddr?.City || null,
          customer.BillAddr?.CountrySubDivisionCode || null,
          customer.BillAddr?.PostalCode || null,
          customer.BillAddr?.Lat || null,
          customer.BillAddr?.Long || null,

          // Shipping
          customer.ShipAddr?.Id || null,
          customer.ShipAddr?.Line1 || null,
          customer.ShipAddr?.City || null,
          customer.ShipAddr?.CountrySubDivisionCode || null,
          customer.ShipAddr?.PostalCode || null,
          customer.ShipAddr?.Lat || null,
          customer.ShipAddr?.Long || null,
        ]
      );
    }
    
    await client.query("COMMIT");
    res.status(200).send({ message: "Customers saved successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DB error:", err);
    res.status(500).send({ error: "DB insert failed" });
  } finally {
    client.release();
  }
});

module.exports = router;
