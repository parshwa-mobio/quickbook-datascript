const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
app.use(bodyParser.json());

app.post("/save-estimates", async (req, res) => {
  const estimatesData = req.body; // Replace with actual JSON parsing if needed
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const est of estimatesData) {
      // Insert BillAddr
      if (est.BillAddr) {
        await client.query(
          `
                    INSERT INTO estimate_addresses (id, line1, line2, line3, line4, city, country_sub_division_code, postal_code, lat, long)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                    ON CONFLICT (id) DO NOTHING
                `,
          [
            est.BillAddr.Id,
            est.BillAddr.Line1 || null,
            est.BillAddr.Line2 || null,
            est.BillAddr.Line3 || null,
            est.BillAddr.Line4 || null,
            est.BillAddr.City || null,
            est.BillAddr.CountrySubDivisionCode || null,
            est.BillAddr.PostalCode || null,
            est.BillAddr.Lat || null,
            est.BillAddr.Long || null,
          ]
        );
      }

      // Insert ShipAddr
      if (est.ShipAddr) {
        await client.query(
          `
                    INSERT INTO estimate_addresses (id, line1, line2, line3, line4, city, country_sub_division_code, postal_code, lat, long)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                    ON CONFLICT (id) DO NOTHING
                `,
          [
            est.ShipAddr.Id,
            est.ShipAddr.Line1 || null,
            est.ShipAddr.Line2 || null,
            est.ShipAddr.Line3 || null,
            est.ShipAddr.Line4 || null,
            est.ShipAddr.City || null,
            est.ShipAddr.CountrySubDivisionCode || null,
            est.ShipAddr.PostalCode || null,
            est.ShipAddr.Lat || null,
            est.ShipAddr.Long || null,
          ]
        );
      }

      // Insert main estimate
      await client.query(
        `
                INSERT INTO estimates (
                    id, domain, sparse, sync_token, create_time, last_updated_time,
                    doc_number, txn_date, currency_value, currency_name, txn_status,
                    customer_value, customer_name, customer_memo, bill_addr_id, ship_addr_id,
                    free_form_address, total_amt, apply_tax_after_discount, print_status,
                    email_status, bill_email, delivery_type
                ) VALUES (
                    $1,$2,$3,$4,$5,$6,
                    $7,$8,$9,$10,$11,
                    $12,$13,$14,$15,$16,
                    $17,$18,$19,$20,
                    $21,$22,$23
                )
                ON CONFLICT (id) DO NOTHING
            `,
        [
          est.Id,
          est.domain,
          est.sparse,
          est.SyncToken,
          est.MetaData?.CreateTime,
          est.MetaData?.LastUpdatedTime,
          est.DocNumber,
          est.TxnDate,
          est.CurrencyRef?.value,
          est.CurrencyRef?.name,
          est.TxnStatus,
          est.CustomerRef?.value,
          est.CustomerRef?.name,
          est.CustomerMemo?.value,
          est.BillAddr?.Id || null,
          est.ShipAddr?.Id || null,
          est.FreeFormAddress,
          est.TotalAmt,
          est.ApplyTaxAfterDiscount,
          est.PrintStatus,
          est.EmailStatus,
          est.BillEmail?.Address,
          est.DeliveryInfo?.DeliveryType || null,
        ]
      );

      // Linked Transactions
      if (Array.isArray(est.LinkedTxn)) {
        for (const ltx of est.LinkedTxn) {
          await client.query(
            `
                        INSERT INTO estimate_linked_txns (estimate_id, txn_id, txn_type)
                        VALUES ($1,$2,$3)
                        ON CONFLICT (estimate_id, txn_id) DO NOTHING
                    `,
            [est.Id, ltx.TxnId, ltx.TxnType]
          );
        }
      }

      // Lines
      if (Array.isArray(est.Line)) {
        for (const ln of est.Line) {
          const lineId = ln.Id || null;
          await client.query(
            `
    INSERT INTO estimate_lines (estimate_id, line_id, line_num, description, amount, detail_type)
    VALUES ($1,$2,$3,$4,$5,$6)
`,
            [
              est.Id,
              ln.Id || null,
              ln.LineNum || null,
              ln.Description || null,
              ln.Amount || null,
              ln.DetailType,
            ]
          );

          if (ln.SalesItemLineDetail) {
            await client.query(
              `
                            INSERT INTO estimate_sales_item_details (
                                estimate_id, line_id, item_ref_value, item_ref_name, unit_price, qty,
                                item_account_ref_value, item_account_ref_name, tax_code_ref_value
                            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                            ON CONFLICT (estimate_id, line_id) DO NOTHING
                        `,
              [
                est.Id,
                lineId,
                ln.SalesItemLineDetail.ItemRef?.value,
                ln.SalesItemLineDetail.ItemRef?.name,
                ln.SalesItemLineDetail.UnitPrice,
                ln.SalesItemLineDetail.Qty,
                ln.SalesItemLineDetail.ItemAccountRef?.value,
                ln.SalesItemLineDetail.ItemAccountRef?.name,
                ln.SalesItemLineDetail.TaxCodeRef?.value,
              ]
            );
          }
        }
      }

      // Tax Details
      if (est.TxnTaxDetail) {
        await client.query(
          `
                    INSERT INTO estimate_txn_tax_details (estimate_id, txn_tax_code_ref_value, total_tax)
                    VALUES ($1,$2,$3)
                    ON CONFLICT (estimate_id) DO NOTHING
                `,
          [
            est.Id,
            est.TxnTaxDetail.TxnTaxCodeRef?.value || null,
            est.TxnTaxDetail.TotalTax || 0,
          ]
        );

        if (Array.isArray(est.TxnTaxDetail.TaxLine)) {
          for (const tl of est.TxnTaxDetail.TaxLine) {
            await client.query(
              `
                            INSERT INTO estimate_tax_lines (
                                estimate_id, amount, detail_type, tax_rate_ref_value, percent_based, tax_percent, net_amount_taxable
                            ) VALUES ($1,$2,$3,$4,$5,$6,$7)
                        `,
              [
                est.Id,
                tl.Amount || null,
                tl.DetailType,
                tl.TaxLineDetail?.TaxRateRef?.value || null,
                tl.TaxLineDetail?.PercentBased || null,
                tl.TaxLineDetail?.TaxPercent || null,
                tl.TaxLineDetail?.NetAmountTaxable || null,
              ]
            );
          }
        }
      }
    }

    await client.query("COMMIT");
    res.send({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).send({ error: err.message });
  } finally {
    client.release();
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
