const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post("/save-bill", async (req, res) => {
  const responseData =  req.body;
  const bills = responseData.Bill||[];

  const client = await pool.connect();
  try {
    for (let bill of bills) {
      await client.query(
        `INSERT INTO bills (
          id, due_date, balance, domain, sparse, sync_token, txn_date,
          currency_code, currency_name, total_amount,
          vendor_id, vendor_name,
          vendor_addr_id, vendor_addr_line1, vendor_addr_city, vendor_addr_state, vendor_addr_postal_code, vendor_addr_lat, vendor_addr_long,
          ap_account_id, ap_account_name,
          create_time, last_updated_time
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10,
          $11, $12,
          $13, $14, $15, $16, $17, $18, $19,
          $20, $21,
          $22, $23
        )
        ON CONFLICT (id) DO UPDATE
        SET due_date = EXCLUDED.due_date,
            balance = EXCLUDED.balance,
            domain = EXCLUDED.domain,
            sparse = EXCLUDED.sparse,
            sync_token = EXCLUDED.sync_token,
            txn_date = EXCLUDED.txn_date,
            currency_code = EXCLUDED.currency_code,
            currency_name = EXCLUDED.currency_name,
            total_amount = EXCLUDED.total_amount,
            vendor_id = EXCLUDED.vendor_id,
            vendor_name = EXCLUDED.vendor_name,
            vendor_addr_id = EXCLUDED.vendor_addr_id,
            vendor_addr_line1 = EXCLUDED.vendor_addr_line1,
            vendor_addr_city = EXCLUDED.vendor_addr_city,
            vendor_addr_state = EXCLUDED.vendor_addr_state,
            vendor_addr_postal_code = EXCLUDED.vendor_addr_postal_code,
            vendor_addr_lat = EXCLUDED.vendor_addr_lat,
            vendor_addr_long = EXCLUDED.vendor_addr_long,
            ap_account_id = EXCLUDED.ap_account_id,
            ap_account_name = EXCLUDED.ap_account_name,
            create_time = EXCLUDED.create_time,
            last_updated_time = EXCLUDED.last_updated_time`,
        [
          bill.Id,
          bill.DueDate || null,
          bill.Balance || 0,
          bill.domain || null,
          bill.sparse || false,
          bill.SyncToken || null,
          bill.TxnDate || null,
          bill.CurrencyRef?.value || null,
          bill.CurrencyRef?.name || null,
          bill.TotalAmt || 0,
          bill.VendorRef?.value || null,
          bill.VendorRef?.name || null,
          bill.VendorAddr?.Id || null,
          bill.VendorAddr?.Line1 || null,
          bill.VendorAddr?.City || null,
          bill.VendorAddr?.CountrySubDivisionCode || null,
          bill.VendorAddr?.PostalCode || null,
          bill.VendorAddr?.Lat || null,
          bill.VendorAddr?.Long || null,
          bill.APAccountRef?.value || null,
          bill.APAccountRef?.name || null,
          bill.MetaData?.CreateTime ? new Date(bill.MetaData.CreateTime) : null,
          bill.MetaData?.LastUpdatedTime
            ? new Date(bill.MetaData.LastUpdatedTime)
            : null,
        ]
      );
    }

    res.status(200).send({ message: "Bills saved successfully" });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).send({ error: "DB insert failed" });
  } finally {
    client.release();
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
