const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");
const app = express();
app.use(bodyParser.json());

app.post("/store-credit-memo", async (req, res) => {
  const responseData = req.body;
  const creditMemos = responseData.CreditMemo || [];
  const db = await pool.connect();

  try {
     for (const memo of creditMemos) {
      // Upsert Bill Address
      let billAddrId = memo.BillAddr?.Id || null;
      if (billAddrId) {
        await db.query(`
          INSERT INTO credit_memo_addresses (id, line1, line2, line3, line4, city, country_sub_division_code, postal_code, lat, long)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (id) DO UPDATE SET
            line1 = EXCLUDED.line1,
            line2 = EXCLUDED.line2,
            line3 = EXCLUDED.line3,
            line4 = EXCLUDED.line4,
            city = EXCLUDED.city,
            country_sub_division_code = EXCLUDED.country_sub_division_code,
            postal_code = EXCLUDED.postal_code,
            lat = EXCLUDED.lat,
            long = EXCLUDED.long
        `, [
          billAddrId, memo.BillAddr.Line1, memo.BillAddr.Line2, memo.BillAddr.Line3,
          memo.BillAddr.Line4, memo.BillAddr.City, memo.BillAddr.CountrySubDivisionCode,
          memo.BillAddr.PostalCode, memo.BillAddr.Lat, memo.BillAddr.Long
        ]);
      }

      // Upsert Ship Address
      let shipAddrId = memo.ShipAddr?.Id || null;
      if (shipAddrId) {
        await db.query(`
          INSERT INTO credit_memo_addresses (id, line1, city, country_sub_division_code, postal_code, lat, long)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT (id) DO UPDATE SET
            line1 = EXCLUDED.line1,
            city = EXCLUDED.city,
            country_sub_division_code = EXCLUDED.country_sub_division_code,
            postal_code = EXCLUDED.postal_code,
            lat = EXCLUDED.lat,
            long = EXCLUDED.long
        `, [
          shipAddrId, memo.ShipAddr.Line1, memo.ShipAddr.City,
          memo.ShipAddr.CountrySubDivisionCode, memo.ShipAddr.PostalCode,
          memo.ShipAddr.Lat, memo.ShipAddr.Long
        ]);
      }

      // Upsert Credit Memo
      await db.query(`
        INSERT INTO credit_memos (
          id, remaining_credit, domain, sparse, sync_token, doc_number, txn_date,
          currency_value, currency_name, total_tax, customer_value, customer_name, customer_memo,
          bill_addr_id, ship_addr_id, free_form_address, total_amt, apply_tax_after_discount,
          print_status, email_status, bill_email, balance,
          metadata_create_time, metadata_last_updated_time
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,$10,$11,$12,$13,
          $14,$15,$16,$17,$18,
          $19,$20,$21,$22,
          $23,$24
        )
        ON CONFLICT (id) DO UPDATE SET
          remaining_credit = EXCLUDED.remaining_credit,
          domain = EXCLUDED.domain,
          sparse = EXCLUDED.sparse,
          sync_token = EXCLUDED.sync_token,
          doc_number = EXCLUDED.doc_number,
          txn_date = EXCLUDED.txn_date,
          currency_value = EXCLUDED.currency_value,
          currency_name = EXCLUDED.currency_name,
          total_tax = EXCLUDED.total_tax,
          customer_value = EXCLUDED.customer_value,
          customer_name = EXCLUDED.customer_name,
          customer_memo = EXCLUDED.customer_memo,
          bill_addr_id = EXCLUDED.bill_addr_id,
          ship_addr_id = EXCLUDED.ship_addr_id,
          free_form_address = EXCLUDED.free_form_address,
          total_amt = EXCLUDED.total_amt,
          apply_tax_after_discount = EXCLUDED.apply_tax_after_discount,
          print_status = EXCLUDED.print_status,
          email_status = EXCLUDED.email_status,
          bill_email = EXCLUDED.bill_email,
          balance = EXCLUDED.balance,
          metadata_create_time = EXCLUDED.metadata_create_time,
          metadata_last_updated_time = EXCLUDED.metadata_last_updated_time
      `, [
        memo.Id, memo.RemainingCredit, memo.domain, memo.sparse, memo.SyncToken,
        memo.DocNumber, memo.TxnDate,
        memo.CurrencyRef?.value, memo.CurrencyRef?.name,
        memo.TxnTaxDetail?.TotalTax,
        memo.CustomerRef?.value, memo.CustomerRef?.name,
        memo.CustomerMemo?.value,
        billAddrId, shipAddrId,
        memo.FreeFormAddress, memo.TotalAmt, memo.ApplyTaxAfterDiscount,
        memo.PrintStatus, memo.EmailStatus, memo.BillEmail?.Address,
        memo.Balance,
        memo.MetaData?.CreateTime, memo.MetaData?.LastUpdatedTime
      ]);

      // Upsert Line Items
      if (Array.isArray(memo.Line)) {
        for (const line of memo.Line) {
          await db.query(`
            INSERT INTO credit_memo_lines (
              credit_memo_id, line_id, line_num, description, amount, detail_type,
              item_ref_value, item_ref_name, unit_price, qty,
              item_account_ref_value, item_account_ref_name, tax_code_ref_value
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          `, [
            memo.Id, line.Id, line.LineNum, line.Description,
            line.Amount, line.DetailType,
            line.SalesItemLineDetail?.ItemRef?.value,
            line.SalesItemLineDetail?.ItemRef?.name,
            line.SalesItemLineDetail?.UnitPrice,
            line.SalesItemLineDetail?.Qty,
            line.SalesItemLineDetail?.ItemAccountRef?.value,
            line.SalesItemLineDetail?.ItemAccountRef?.name,
            line.SalesItemLineDetail?.TaxCodeRef?.value
          ]);
        }
      }
    }

    res.json({ success: true, message: "Credit memos stored successfully" });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ error: "Failed to store credit memos" });
  } finally {
    db.release();
  }
});

app.listen(5000, () => console.log("Service running on port 5000"));
