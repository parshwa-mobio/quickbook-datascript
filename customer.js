const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const router = express.Router();
router.use(bodyParser.json());

// Save Customer Data API
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

// Customer Balance Detail API
router.post("/customer-balance-detail", async (req, res) => {
  try {
    const report = req.body;

    const reportDate =
      report.Header.Option.find((opt) => opt.Name === "report_date")?.Value ||
      report.Header.EndPeriod;

    if (!reportDate)
      return res.status(400).json({ message: "Report date missing" });

    const rows = report.Rows.Row;
    const insertPromises = [];

    const processRow = (row, customer = null, subSection = null) => {
      // Nested Rows (Sections)
      if (row.Rows && row.Rows.Row) {
        const currentCustomer = row.Header?.ColData[0]?.value || customer;
        row.Rows.Row.forEach((nestedRow) =>
          processRow(nestedRow, currentCustomer, row.Header?.ColData[0]?.value)
        );
      }

      // Data Rows
      if (row.ColData) {
        const col = row.ColData;
        const tx_date = col[0]?.value || null;
        const txn_type = col[1]?.value || null;
        const doc_num = col[2]?.value || null;
        const due_date = col[3]?.value || null;
        const amount = parseFloat(col[4]?.value) || 0;
        const open_balance = parseFloat(col[5]?.value) || 0;
        const balance = parseFloat(col[6]?.value) || 0;

        if (customer) {
          insertPromises.push(
            pool.query(
              `INSERT INTO customer_balance_detail
               (report_date, customer_name, sub_section, tx_date, txn_type, doc_num, due_date, amount, open_balance, balance)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
               ON CONFLICT(report_date, customer_name, sub_section, doc_num)
               DO UPDATE SET amount=EXCLUDED.amount, open_balance=EXCLUDED.open_balance, balance=EXCLUDED.balance`,
              [
                reportDate,
                customer,
                subSection,
                tx_date,
                txn_type,
                doc_num,
                due_date,
                amount,
                open_balance,
                balance,
              ]
            )
          );
        }
      }

      // Summary Rows
      if (row.Summary && row.Summary.ColData) {
        const col = row.Summary.ColData;
        const amount = parseFloat(col[4]?.value) || 0;
        const open_balance = parseFloat(col[5]?.value) || 0;

        if (customer) {
          insertPromises.push(
            pool.query(
              `INSERT INTO customer_balance_detail
               (report_date, customer_name, sub_section, amount, open_balance)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT(report_date, customer_name, sub_section)
               DO UPDATE SET amount=EXCLUDED.amount, open_balance=EXCLUDED.open_balance`,
              [reportDate, customer, subSection, amount, open_balance]
            )
          );
        }
      }
    };

    rows.forEach((row) => processRow(row));

    await Promise.all(insertPromises);

    res.json({ message: "Customer Balance Detail saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// Customer Balance API
router.post("/customer-balance", async (req, res) => {
  try {
    const report = req.body;

    const reportDate =
      report.Header.Option.find((opt) => opt.Name === "report_date")?.Value ||
      report.Header.EndPeriod;

    if (!reportDate)
      return res.status(400).json({ message: "Report date missing" });

    const rows = report.Rows.Row;
    const insertPromises = [];

    const processRow = (row, section = null) => {
      // Nested Rows in sections
      if (row.Rows && row.Rows.Row) {
        const sectionName = row.Header?.ColData[0]?.value || section;
        row.Rows.Row.forEach((nestedRow) => processRow(nestedRow, sectionName));
      }

      // Normal ColData rows
      if (row.ColData) {
        const col = row.ColData;
        const customer_name = col[0]?.value || null;
        const total = parseFloat(col[1]?.value) || 0;

        if (customer_name) {
          insertPromises.push(
            pool.query(
              `INSERT INTO customer_balance (report_date, section, customer_name, total)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT(report_date, section, customer_name)
               DO UPDATE SET total = EXCLUDED.total`,
              [reportDate, section, customer_name, total]
            )
          );
        }
      }

      // Summary rows
      if (row.Summary && row.Summary.ColData) {
        const col = row.Summary.ColData;
        const customer_name = col[0]?.value || null;
        const total = parseFloat(col[1]?.value) || 0;

        if (customer_name) {
          insertPromises.push(
            pool.query(
              `INSERT INTO customer_balance (report_date, section, customer_name, total)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT(report_date, section, customer_name)
               DO UPDATE SET total = EXCLUDED.total`,
              [reportDate, section, customer_name, total]
            )
          );
        }
      }
    };

    rows.forEach((row) => processRow(row));

    await Promise.all(insertPromises);

    res.json({ message: "Customer Balance saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// Customer Income API
router.post("/customer-income", async (req, res) => {
  try {
    const report = req.body;

    const reportDate =
      report.Header.Option.find((opt) => opt.Name === "report_date")?.Value ||
      report.Header.EndPeriod;

    if (!reportDate)
      return res.status(400).json({ message: "Report date missing" });

    const rows = report.Rows.Row;
    const insertPromises = [];

    const processRow = (row, customer = null, subSection = null) => {
      // Nested Rows (Sections)
      if (row.Rows && row.Rows.Row) {
        const currentCustomer = row.Header?.ColData[0]?.value || customer;
        row.Rows.Row.forEach((nestedRow) =>
          processRow(nestedRow, currentCustomer, row.Header?.ColData[0]?.value)
        );
      }

      // Data Rows
      if (row.ColData) {
        const col = row.ColData;
        const income = parseFloat(col[1]?.value) || 0;
        const expense = parseFloat(col[2]?.value) || 0;
        const net_income = parseFloat(col[3]?.value) || 0;

        if (customer) {
          insertPromises.push(
            pool.query(
              `INSERT INTO customer_income
               (report_date, customer_name, sub_section, income, expense, net_income)
               VALUES ($1,$2,$3,$4,$5,$6)
               ON CONFLICT(report_date, customer_name, sub_section)
               DO UPDATE SET income=EXCLUDED.income, expense=EXCLUDED.expense, net_income=EXCLUDED.net_income`,
              [reportDate, customer, subSection, income, expense, net_income]
            )
          );
        }
      }

      // Summary Rows
      if (row.Summary && row.Summary.ColData) {
        const col = row.Summary.ColData;
        const income = parseFloat(col[1]?.value) || 0;
        const expense = parseFloat(col[2]?.value) || 0;
        const net_income = parseFloat(col[3]?.value) || 0;

        if (customer) {
          insertPromises.push(
            pool.query(
              `INSERT INTO customer_income
               (report_date, customer_name, sub_section, income, expense, net_income)
               VALUES ($1,$2,$3,$4,$5,$6)
               ON CONFLICT(report_date, customer_name, sub_section)
               DO UPDATE SET income=EXCLUDED.income, expense=EXCLUDED.expense, net_income=EXCLUDED.net_income`,
              [reportDate, customer, subSection, income, expense, net_income]
            )
          );
        }
      }
    };

    rows.forEach((row) => processRow(row));

    await Promise.all(insertPromises);

    res.json({ message: "Customer Income saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

module.exports = router;
