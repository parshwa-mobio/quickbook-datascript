const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
app.use(bodyParser.json());

app.post("/save-preferences", async (req, res) => {
  const data = req.body[0];
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Insert into qb_preferences
    const prefResult = await client.query(
      `INSERT INTO qb_preferences (qb_id, sync_token, domain, sparse, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        data.Id,
        data.SyncToken,
        data.domain,
        data.sparse,
        data.MetaData.CreateTime,
        data.MetaData.LastUpdatedTime,
      ]
    );
    const preferencesId = prefResult.rows[0].id;

    // Accounting Info Prefs
    if (data.AccountingInfoPrefs) {
      await client.query(
        `INSERT INTO qb_accounting_info_prefs 
        (preferences_id, use_account_numbers, track_departments, class_tracking_per_txn, 
         class_tracking_per_txn_line, first_month_of_fiscal_year, tax_year_month, tax_form, customer_terminology)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          preferencesId,
          data.AccountingInfoPrefs.UseAccountNumbers,
          data.AccountingInfoPrefs.TrackDepartments,
          data.AccountingInfoPrefs.ClassTrackingPerTxn,
          data.AccountingInfoPrefs.ClassTrackingPerTxnLine,
          data.AccountingInfoPrefs.FirstMonthOfFiscalYear,
          data.AccountingInfoPrefs.TaxYearMonth,
          data.AccountingInfoPrefs.TaxForm,
          data.AccountingInfoPrefs.CustomerTerminology,
        ]
      );
    }

    // Product & Services Prefs
    if (data.ProductAndServicesPrefs) {
      await client.query(
        `INSERT INTO qb_product_services_prefs
        (preferences_id, for_sales, for_purchase, quantity_with_price_and_rate, quantity_on_hand,
         revenue_recognition, revenue_recognition_frequency)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          preferencesId,
          data.ProductAndServicesPrefs.ForSales,
          data.ProductAndServicesPrefs.ForPurchase,
          data.ProductAndServicesPrefs.QuantityWithPriceAndRate,
          data.ProductAndServicesPrefs.QuantityOnHand,
          data.ProductAndServicesPrefs.RevenueRecognition,
          data.ProductAndServicesPrefs.RevenueRecognitionFrequency,
        ]
      );
    }

    // Sales Forms Prefs
    if (data.SalesFormsPrefs) {
      await client.query(
        `INSERT INTO qb_sales_forms_prefs
        (preferences_id, custom_txn_numbers, email_copy_to_company, allow_deposit, allow_discount,
         default_discount_account, allow_estimates, e_transaction_enabled_status, e_transaction_attach_pdf,
         e_transaction_payment_enabled, ipn_support_enabled, allow_service_date, allow_shipping,
         default_terms, auto_apply_credit, auto_apply_payments, using_price_levels, default_customer_message)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          preferencesId,
          data.SalesFormsPrefs.CustomTxnNumbers,
          data.SalesFormsPrefs.EmailCopyToCompany,
          data.SalesFormsPrefs.AllowDeposit,
          data.SalesFormsPrefs.AllowDiscount,
          data.SalesFormsPrefs.DefaultDiscountAccount,
          data.SalesFormsPrefs.AllowEstimates,
          data.SalesFormsPrefs.ETransactionEnabledStatus,
          data.SalesFormsPrefs.ETransactionAttachPDF,
          data.SalesFormsPrefs.ETransactionPaymentEnabled,
          data.SalesFormsPrefs.IPNSupportEnabled,
          data.SalesFormsPrefs.AllowServiceDate,
          data.SalesFormsPrefs.AllowShipping,
          data.SalesFormsPrefs.DefaultTerms?.value || null,
          data.SalesFormsPrefs.AutoApplyCredit,
          data.SalesFormsPrefs.AutoApplyPayments,
          data.SalesFormsPrefs.UsingPriceLevels,
          data.SalesFormsPrefs.DefaultCustomerMessage,
        ]
      );

      // Email Messages Prefs
      if (data.EmailMessagesPrefs) {
        const emailMessages = [
          "InvoiceMessage",
          "EstimateMessage",
          "SalesReceiptMessage",
          "StatementMessage",
        ];
        for (const type of emailMessages) {
          const msg = data.EmailMessagesPrefs[type];
          if (msg) {
            await client.query(
              `INSERT INTO qb_email_messages_prefs
              (preferences_id, type, subject, message)
              VALUES ($1,$2,$3,$4)`,
              [preferencesId, type, msg.Subject, msg.Message]
            );
          }
        }
      }
    }

    // Vendor & Purchases Prefs
    if (data.VendorAndPurchasesPrefs) {
      await client.query(
        `INSERT INTO qb_vendor_purchases_prefs
        (preferences_id, tracking_by_customer, billable_expense_tracking)
        VALUES ($1,$2,$3)`,
        [
          preferencesId,
          data.VendorAndPurchasesPrefs.TrackingByCustomer,
          data.VendorAndPurchasesPrefs.BillableExpenseTracking,
        ]
      );
    }

    // Time Tracking Prefs
    if (data.TimeTrackingPrefs) {
      await client.query(
        `INSERT INTO qb_time_tracking_prefs
        (preferences_id, use_services, default_time_item, bill_customers, show_bill_rate_to_all,
         work_week_start_date, mark_time_entries_billable)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          preferencesId,
          data.TimeTrackingPrefs.UseServices,
          data.TimeTrackingPrefs.DefaultTimeItem?.value || null,
          data.TimeTrackingPrefs.BillCustomers,
          data.TimeTrackingPrefs.ShowBillRateToAll,
          data.TimeTrackingPrefs.WorkWeekStartDate,
          data.TimeTrackingPrefs.MarkTimeEntriesBillable,
        ]
      );
    }

    // Tax Prefs
    if (data.TaxPrefs) {
      await client.query(
        `INSERT INTO qb_tax_prefs
        (preferences_id, using_sales_tax, tax_group_code_ref)
        VALUES ($1,$2,$3)`,
        [
          preferencesId,
          data.TaxPrefs.UsingSalesTax,
          data.TaxPrefs.TaxGroupCodeRef?.value || null,
        ]
      );
    }

    // Currency Prefs
    if (data.CurrencyPrefs) {
      await client.query(
        `INSERT INTO qb_currency_prefs
        (preferences_id, multi_currency_enabled, home_currency)
        VALUES ($1,$2,$3)`,
        [
          preferencesId,
          data.CurrencyPrefs.MultiCurrencyEnabled,
          data.CurrencyPrefs.HomeCurrency?.value || null,
        ]
      );
    }

    // Report Prefs
    if (data.ReportPrefs) {
      await client.query(
        `INSERT INTO qb_report_prefs
        (preferences_id, report_basis, calc_aging_report_from_txn_date)
        VALUES ($1,$2,$3)`,
        [
          preferencesId,
          data.ReportPrefs.ReportBasis,
          data.ReportPrefs.CalcAgingReportFromTxnDate,
        ]
      );
    }

    // Other Prefs
    if (data.OtherPrefs?.NameValue) {
      for (const nv of data.OtherPrefs.NameValue) {
        await client.query(
          `INSERT INTO qb_other_prefs
          (preferences_id, name, value)
          VALUES ($1,$2,$3)`,
          [preferencesId, nv.Name, nv.Value]
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json({ message: "Preferences saved successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error saving preferences:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
