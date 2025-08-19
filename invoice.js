const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
app.use(bodyParser.json());

app.post("/save-invoice", async (req, res) => {
  const invoices = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const inv of invoices) {
      const invResult = await client.query(
        `INSERT INTO invoice (
                    qb_invoice_id, sync_token, doc_number, txn_date, currency_value, currency_name,
                    customer_id, customer_name, customer_memo,
                    bill_addr_line1, bill_addr_line2, bill_addr_line3, bill_addr_line4,
                    bill_addr_lat, bill_addr_long,
                    ship_addr_line1, ship_addr_city, ship_addr_state, ship_addr_postal_code,
                    ship_addr_lat, ship_addr_long,
                    sales_term_value, sales_term_name, due_date, total_amt, total_tax,
                    apply_tax_after_discount, print_status, email_status, bill_email, balance,
                    create_time, last_updated_time
                ) VALUES (
                    $1,$2,$3,$4,$5,$6,
                    $7,$8,$9,
                    $10,$11,$12,$13,
                    $14,$15,
                    $16,$17,$18,$19,
                    $20,$21,
                    $22,$23,$24,$25,$26,
                    $27,$28,$29,$30,$31,
                    $32,$33
                ) RETURNING id`,
        [
          inv.Id,
          inv.SyncToken,
          inv.DocNumber,
          inv.TxnDate,
          inv.CurrencyRef?.value,
          inv.CurrencyRef?.name,
          inv.CustomerRef?.value,
          inv.CustomerRef?.name,
          inv.CustomerMemo?.value || null,
          inv.BillAddr?.Line1,
          inv.BillAddr?.Line2,
          inv.BillAddr?.Line3,
          inv.BillAddr?.Line4,
          inv.BillAddr?.Lat,
          inv.BillAddr?.Long,
          inv.ShipAddr?.Line1,
          inv.ShipAddr?.City,
          inv.ShipAddr?.CountrySubDivisionCode,
          inv.ShipAddr?.PostalCode,
          inv.ShipAddr?.Lat,
          inv.ShipAddr?.Long,
          inv.SalesTermRef?.value,
          inv.SalesTermRef?.name,
          inv.DueDate,
          inv.TotalAmt,
          inv.TxnTaxDetail?.TotalTax,
          inv.ApplyTaxAfterDiscount,
          inv.PrintStatus,
          inv.EmailStatus,
          inv.BillEmail?.Address,
          inv.Balance,
          inv.MetaData?.CreateTime,
          inv.MetaData?.LastUpdatedTime,
        ]
      );

      const invoiceId = invResult.rows[0].id;

      // Insert Lines
      if (inv.Line) {
        for (const line of inv.Line) {
          await client.query(
            `INSERT INTO invoice_line (
                            invoice_id, line_id, line_num, description, amount, detail_type,
                            item_ref_value, item_ref_name, unit_price, qty,
                            item_account_ref_value, item_account_ref_name, tax_code_ref_value
                        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
              invoiceId,
              line.Id || null,
              line.LineNum || null,
              line.Description || null,
              line.Amount || null,
              line.DetailType || null,
              line.SalesItemLineDetail?.ItemRef?.value || null,
              line.SalesItemLineDetail?.ItemRef?.name || null,
              line.SalesItemLineDetail?.UnitPrice || null,
              line.SalesItemLineDetail?.Qty || null,
              line.SalesItemLineDetail?.ItemAccountRef?.value || null,
              line.SalesItemLineDetail?.ItemAccountRef?.name || null,
              line.SalesItemLineDetail?.TaxCodeRef?.value || null,
            ]
          );
        }
      }

      // Insert Tax Lines
      if (inv.TxnTaxDetail?.TaxLine) {
        for (const taxLine of inv.TxnTaxDetail.TaxLine) {
          await client.query(
            `INSERT INTO invoice_tax_line (
                            invoice_id, amount, tax_rate_ref_value, percent_based, tax_percent, net_amount_taxable
                        ) VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              invoiceId,
              taxLine.Amount || null,
              taxLine.TaxLineDetail?.TaxRateRef?.value || null,
              taxLine.TaxLineDetail?.PercentBased || null,
              taxLine.TaxLineDetail?.TaxPercent || null,
              taxLine.TaxLineDetail?.NetAmountTaxable || null,
            ]
          );
        }
      }
    }

    await client.query("COMMIT");
    res.status(200).send({ message: "Invoices saved successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).send({ error: "Failed to save invoices" });
  } finally {
    client.release();
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
