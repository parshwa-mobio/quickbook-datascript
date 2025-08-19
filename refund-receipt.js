const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db"); // pg connection

const app = express();
app.use(bodyParser.json());

app.post('/saveRefundReceipts', async (req, res) => {
  try {
    const { QueryResponse } = req.body;
    if (!QueryResponse || !QueryResponse.RefundReceipt) {
      return res.status(400).json({ message: "RefundReceipt data missing" });
    }

    for (const rr of QueryResponse.RefundReceipt) {
      // Insert main refund receipt
      await pool.query(
        `INSERT INTO refund_receipts (
          id, domain, sparse, sync_token, create_time, last_updated_time,
          doc_number, txn_date, currency_value, currency_name, total_amt, total_tax,
          customer_ref_value, customer_ref_name, customer_memo,
          bill_addr_id, bill_line1, bill_line2, bill_line3, bill_line4,
          bill_lat, bill_long, free_form_address, apply_tax_after_discount,
          print_status, bill_email, balance,
          payment_method_ref_value, payment_method_ref_name,
          deposit_to_account_ref_value, deposit_to_account_ref_name
        ) VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,$11,$12,
          $13,$14,$15,
          $16,$17,$18,$19,$20,
          $21,$22,$23,$24,
          $25,$26,$27,
          $28,$29,$30,$31
        )
        ON CONFLICT (id) DO UPDATE SET
          last_updated_time = EXCLUDED.last_updated_time,
          total_amt = EXCLUDED.total_amt,
          total_tax = EXCLUDED.total_tax,
          balance = EXCLUDED.balance`,
        [
          rr.Id, rr.domain, rr.sparse, rr.SyncToken,
          rr.MetaData?.CreateTime, rr.MetaData?.LastUpdatedTime,
          rr.DocNumber, rr.TxnDate,
          rr.CurrencyRef?.value, rr.CurrencyRef?.name,
          rr.TotalAmt, rr.TxnTaxDetail?.TotalTax,
          rr.CustomerRef?.value, rr.CustomerRef?.name,
          rr.CustomerMemo?.value,
          rr.BillAddr?.Id, rr.BillAddr?.Line1, rr.BillAddr?.Line2,
          rr.BillAddr?.Line3, rr.BillAddr?.Line4,
          rr.BillAddr?.Lat, rr.BillAddr?.Long,
          rr.FreeFormAddress, rr.ApplyTaxAfterDiscount,
          rr.PrintStatus, rr.BillEmail?.Address, rr.Balance,
          rr.PaymentMethodRef?.value, rr.PaymentMethodRef?.name,
          rr.DepositToAccountRef?.value, rr.DepositToAccountRef?.name
        ]
      );

      // Insert line items
      if (rr.Line) {
        for (const line of rr.Line) {
          await pool.query(
            `INSERT INTO refund_receipt_lines (
              refund_receipt_id, line_id, line_num, description, amount, detail_type,
              item_ref_value, item_ref_name, unit_price, qty,
              item_account_ref_value, item_account_ref_name, tax_code_ref
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
              rr.Id,
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
              line.SalesItemLineDetail?.TaxCodeRef?.value || null
            ]
          );
        }
      }
    }

    res.json({ message: "Refund Receipts saved successfully" });
  } catch (err) {
    console.error("Error saving refund receipts:", err);
    res.status(500).json({ message: "Error saving refund receipts", error: err.message });
  }
});


app.listen(5000, () => {
  console.log("Reimburse Charges service running on port 5000");
});
