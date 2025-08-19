const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db"); // pg connection

const app = express();
app.use(bodyParser.json());

app.post("/recurring-bills", async (req, res) => {
  const client = await pool.connect();
  try {
    const { QueryResponse } = req.body;
    const recurringTxns = QueryResponse?.RecurringTransaction || [];

    await client.query("BEGIN");

    for (const txn of recurringTxns) {
      const bill = txn.Bill;
      if (!bill) continue;

      // Insert into recurring_bills
      await client.query(
        `INSERT INTO recurring_bills (
    id, sync_token, balance, total_amt,
    currency_value, currency_name,
    vendor_id, vendor_name, vendor_line1, vendor_city,
    vendor_state, vendor_postal, vendor_lat, vendor_long,
    sales_term_ref, ap_account_id, ap_account_name, recur_data_ref,
    recur_name, recur_type, recur_active, recur_interval_type,
    recur_num_interval, recur_day_of_month, recur_next_date,
    created_time, last_updated_time, last_modified_by
  ) VALUES (
    $1,$2,$3,$4,
    $5,$6,
    $7,$8,$9,$10,
    $11,$12,$13,$14,
    $15,$16,$17,$18,
    $19,$20,$21,$22,
    $23,$24,$25,
    $26,$27,$28
  )
  ON CONFLICT (id) DO NOTHING`,
        [
          bill.Id,
          bill.SyncToken,
          bill.Balance,
          bill.TotalAmt,
          bill.CurrencyRef?.value || null,
          bill.CurrencyRef?.name || null,
          bill.VendorRef?.value || null,
          bill.VendorRef?.name || null,
          bill.VendorAddr?.Line1 || null,
          bill.VendorAddr?.City || null,
          bill.VendorAddr?.CountrySubDivisionCode || null,
          bill.VendorAddr?.PostalCode || null,
          bill.VendorAddr?.Lat || null,
          bill.VendorAddr?.Long || null,
          bill.SalesTermRef?.value || null,
          bill.APAccountRef?.value || null,
          bill.APAccountRef?.name || null,
          bill.RecurDataRef?.value || null,
          bill.RecurringInfo?.Name || null,
          bill.RecurringInfo?.RecurType || null,
          bill.RecurringInfo?.Active || null,
          bill.RecurringInfo?.ScheduleInfo?.IntervalType || null,
          bill.RecurringInfo?.ScheduleInfo?.NumInterval || null,
          bill.RecurringInfo?.ScheduleInfo?.DayOfMonth || null,
          bill.RecurringInfo?.ScheduleInfo?.NextDate || null,
          bill.MetaData?.CreateTime || null,
          bill.MetaData?.LastUpdatedTime || null,
          bill.MetaData?.LastModifiedByRef?.value || null,
        ]
      );

      // Insert line items
      for (const line of bill.Line || []) {
        await client.query(
          `INSERT INTO recurring_bill_lines (
            bill_id, line_id, line_num, description,
            amount, detail_type, account_ref_id, account_ref_name,
            billable_status, tax_code_ref
          ) VALUES (
            $1,$2,$3,$4,
            $5,$6,$7,$8,
            $9,$10
          )`,
          [
            bill.Id,
            line.Id,
            line.LineNum,
            line.Description,
            line.Amount,
            line.DetailType,
            line.AccountBasedExpenseLineDetail?.AccountRef?.value || null,
            line.AccountBasedExpenseLineDetail?.AccountRef?.name || null,
            line.AccountBasedExpenseLineDetail?.BillableStatus || null,
            line.AccountBasedExpenseLineDetail?.TaxCodeRef?.value || null,
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Recurring Bills saved successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving recurring bills:", error);
    res.status(500).json({ error: "Failed to save recurring bills" });
  } finally {
    client.release();
  }
});

app.listen(5000, () => {
  console.log("Recurring Bills service running on port 5000");
});
