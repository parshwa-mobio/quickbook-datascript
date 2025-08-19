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
    res.status(500).send({ error: "Failed to save vendors" });
  } finally {
    client.release();
  }
});

app.post("/vendorbybalance", async (req, res) => {
  const reportData = req.body;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (!reportData.Rows || !reportData.Rows.Row) {
      return res.status(400).send({
        error: "Invalid data structure for vendor balance report",
        message: "Expected structure with Rows.Row property. This appears to be VendorCredit data - use /vendorcredit endpoint instead."
      });
    }

    // Tables already exist

    const header = reportData.Header || {};
    const options = header.Option || [];
    const reportDate = options.find(o => o.Name === "report_date")?.Value || null;
    const noReportData = options.find(o => o.Name === "NoReportData")?.Value === "true";

    // Find grand total row
    const grandTotalRow = reportData.Rows.Row.find(r => r.group === "GrandTotal");
    const totalAmount = grandTotalRow?.Summary?.ColData?.[1]?.value || 0;

    // Insert into reports table
    const result = await client.query(
      `INSERT INTO vendor_balance_reports
        (report_name, report_time, date_macro, currency, report_date, no_report_data, total_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        header.ReportName,
        header.Time,
        header.DateMacro,
        header.Currency,
        reportDate,
        noReportData,
        totalAmount
      ]
    );

    const reportId = result.rows[0].id;

    // Insert vendor balances
    for (const row of reportData.Rows.Row) {
      if (row.ColData) {
        const vendorName = row.ColData[0]?.value || null;
        const vendorId = row.ColData[0]?.id || null;
        const balance = row.ColData[1]?.value || 0;

        await client.query(
          `INSERT INTO vendor_balance_report_rows
            (report_id, vendor_id, vendor_name, balance)
           VALUES ($1, $2, $3, $4)`,
          [reportId, vendorId, vendorName, balance]
        );
      }
    }

    await client.query("COMMIT");
    res.status(200).send({
      message: "Vendor Balance Report saved successfully",
      reportId: reportId,
      totalAmount: totalAmount
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).send({ 
      error: "Error saving vendor balance report", 
      details: err.message 
    });
  } finally {
    client.release();
  }
});

app.post("/vendorbalancedetail", async (req, res) => {
  const reportData = req.body;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (!reportData.Rows || !reportData.Rows.Row) {
      return res.status(400).send({
        error: "Invalid data structure for vendor balance detail report",
        message: "Expected structure with Rows.Row property. This appears to be VendorCredit data - use /vendorcredit endpoint instead."
      });
    }

    // Tables already exist

    const header = reportData.Header || {};
    const options = header.Option || [];
    const reportDate = options.find(o => o.Name === "report_date")?.Value || null;
    const noReportData = options.find(o => o.Name === "NoReportData")?.Value === "true";
    const vendorId = header.Vendor || null;

    // Find grand total row
    const grandTotalRow = reportData.Rows.Row.find(r => r.Summary && r.Summary.ColData?.[0]?.value === "TOTAL");
    const totalAmount = grandTotalRow?.Summary?.ColData?.[4]?.value || 0;
    const totalOpenBalance = grandTotalRow?.Summary?.ColData?.[5]?.value || 0;

    // Insert into reports table
    const result = await client.query(
      `INSERT INTO vendor_balance_detail_reports
        (report_name, report_time, date_macro, currency, vendor_id, report_date, no_report_data, total_amount, total_open_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        header.ReportName,
        header.Time,
        header.DateMacro,
        header.Currency,
        vendorId,
        reportDate,
        noReportData,
        totalAmount,
        totalOpenBalance
      ]
    );

    const reportId = result.rows[0].id;

    // Process vendor sections and their transactions
    for (const section of reportData.Rows.Row) {
      if (section.Header && section.Rows) {
        const vendorName = section.Header.ColData?.[0]?.value || null;
        const sectionVendorId = section.Header.ColData?.[0]?.id || vendorId;

        // Insert each transaction in this vendor section
        for (const txnRow of section.Rows.Row) {
          if (txnRow.ColData && txnRow.type === "Data") {
            await client.query(
              `INSERT INTO vendor_balance_detail_transactions
                (report_id, vendor_id, vendor_name, transaction_date, transaction_type, transaction_id, 
                 document_number, due_date, amount, open_balance, running_balance)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                reportId,
                sectionVendorId,
                vendorName,
                txnRow.ColData[0]?.value || null, // Date
                txnRow.ColData[1]?.value || null, // Transaction Type
                txnRow.ColData[1]?.id || null,    // Transaction ID
                txnRow.ColData[2]?.value || null, // Document Number
                txnRow.ColData[3]?.value || null, // Due Date
                txnRow.ColData[4]?.value || 0,    // Amount
                txnRow.ColData[5]?.value || 0,    // Open Balance
                txnRow.ColData[6]?.value || 0     // Running Balance
              ]
            );
          }
        }
      }
    }
    await client.query("COMMIT");
    res.status(200).send({
      message: "Vendor Balance Detail Report saved successfully",
      reportId: reportId,
      vendorId: vendorId,
      totalAmount: totalAmount,
      totalOpenBalance: totalOpenBalance
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).send({ 
      error: "Error saving vendor balance detail report", 
      details: err.message 
    });
  } finally {
    client.release();
  }
});

app.post("/vendorcredit", async (req, res) => {
  const creditData = req.body;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Tables already exist

    const queryResponse = creditData.QueryResponse || {};
    const vendorCredits = queryResponse.VendorCredit || [];
    const queryTime = creditData.time || null;

    // Process each vendor credit
    for (const credit of vendorCredits) {
      // Insert vendor credit
      const result = await client.query(
        `INSERT INTO vendor_credits (
          qb_id, sync_token, vendor_id, vendor_name, balance, domain, sparse,
          create_time, last_updated_time, txn_date, currency_code, currency_name,
          total_amount, vendor_addr_id, vendor_addr_line1, vendor_addr_city,
          vendor_addr_state, vendor_addr_postal_code, vendor_addr_lat, vendor_addr_long,
          ap_account_id, ap_account_name, linked_txn_id, linked_txn_type, query_time,
          start_position, max_results, total_count
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
        ) RETURNING id`,
        [
          credit.Id,
          credit.SyncToken,
          credit.VendorRef?.value || null,
          credit.VendorRef?.name || null,
          credit.Balance || 0,
          credit.domain || null,
          credit.sparse || false,
          credit.MetaData?.CreateTime || null,
          credit.MetaData?.LastUpdatedTime || null,
          credit.TxnDate || null,
          credit.CurrencyRef?.value || null,
          credit.CurrencyRef?.name || null,
          credit.TotalAmt || 0,
          credit.VendorAddr?.Id || null,
          credit.VendorAddr?.Line1 || null,
          credit.VendorAddr?.City || null,
          credit.VendorAddr?.CountrySubDivisionCode || null,
          credit.VendorAddr?.PostalCode || null,
          credit.VendorAddr?.Lat || null,
          credit.VendorAddr?.Long || null,
          credit.APAccountRef?.value || null,
          credit.APAccountRef?.name || null,
          credit.LinkedTxn?.[0]?.TxnId || null,
          credit.LinkedTxn?.[0]?.TxnType || null,
          queryTime,
          queryResponse.startPosition || null,
          queryResponse.maxResults || null,
          queryResponse.totalCount || null
        ]
      );

      const creditDbId = result.rows[0].id;

      // Insert credit lines
      if (credit.Line) {
        for (const line of credit.Line) {
          await client.query(
            `INSERT INTO vendor_credit_lines (
              credit_id, line_id, line_num, amount, detail_type, customer_id, customer_name,
              account_id, account_name, billable_status, tax_code, project_id,
              linked_txn_id, linked_txn_type
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            )`,
            [
              creditDbId,
              line.Id || null,
              line.LineNum || null,
              line.Amount || 0,
              line.DetailType || null,
              line.AccountBasedExpenseLineDetail?.CustomerRef?.value || null,
              line.AccountBasedExpenseLineDetail?.CustomerRef?.name || null,
              line.AccountBasedExpenseLineDetail?.AccountRef?.value || null,
              line.AccountBasedExpenseLineDetail?.AccountRef?.name || null,
              line.AccountBasedExpenseLineDetail?.BillableStatus || null,
              line.AccountBasedExpenseLineDetail?.TaxCodeRef?.value || null,
              line.ProjectRef?.value || null,
              line.LinkedTxn?.[0]?.TxnId || null,
              line.LinkedTxn?.[0]?.TxnType || null
            ]
          );
        }
      }
    }

    await client.query("COMMIT");
    res.status(200).send({
      message: "Vendor Credits saved successfully",
      totalCredits: vendorCredits.length,
      startPosition: queryResponse.startPosition,
      maxResults: queryResponse.maxResults,
      totalCount: queryResponse.totalCount
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).send({ 
      error: "Error saving vendor credits", 
      details: err.message 
    });
  } finally {
    client.release();
  }
});

app.post("/vendorexpenses", async (req, res) => {
  const reportData = req.body;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (!reportData.Rows || !reportData.Rows.Row) {
      return res.status(400).send({
        error: "Invalid data structure for vendor expenses report",
        message: "Expected structure with Rows.Row property."
      });
    }

    // Tables already exist

    const header = reportData.Header || {};
    const columns = reportData.Columns || {};
    const options = header.Option || [];
    const noReportData = options.find(o => o.Name === "NoReportData")?.Value === "true";

    // Find grand total row
    const grandTotalRow = reportData.Rows.Row.find(r => r.group === "GrandTotal");
    const totalAmount = grandTotalRow?.Summary?.ColData?.[1]?.value || 0;

    // Insert into reports table with all header information
    const result = await client.query(
      `INSERT INTO vendor_expense_reports
        (report_name, report_time, date_macro, report_basis, start_period, end_period, 
         summarize_columns_by, currency, no_report_data, total_amount, header_options, 
         columns_info, full_header)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        header.ReportName,
        header.Time,
        header.DateMacro,
        header.ReportBasis,
        header.StartPeriod,
        header.EndPeriod,
        header.SummarizeColumnsBy,
        header.Currency,
        noReportData,
        totalAmount,
        JSON.stringify(options),
        JSON.stringify(columns),
        JSON.stringify(header)
      ]
    );

    const reportId = result.rows[0].id;

    // Insert all rows including summary and grouped rows
    for (const row of reportData.Rows.Row) {
      // Determine row type and extract data
      const rowType = row.type || (row.group ? 'grouped' : 'data');
      const rowGroup = row.group || null;
      
      // Extract vendor information
      let vendorId = null;
      let vendorName = null;
      let amount = 0;
      
      if (row.ColData) {
        vendorId = row.ColData[0]?.id || null;
        vendorName = row.ColData[0]?.value || null;
        amount = parseFloat(row.ColData[1]?.value) || 0;
      } else if (row.Summary?.ColData) {
        vendorName = row.Summary.ColData[0]?.value || null;
        amount = parseFloat(row.Summary.ColData[1]?.value) || 0;
      }

      await client.query(
        `INSERT INTO vendor_expense_report_rows
          (report_id, vendor_id, vendor_name, total_amount, row_type, row_group, 
           col_data, summary_data, full_row_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          reportId,
          vendorId,
          vendorName,
          amount,
          rowType,
          rowGroup,
          JSON.stringify(row.ColData || null),
          JSON.stringify(row.Summary || null),
          JSON.stringify(row)
        ]
      );
    }

    await client.query("COMMIT");
    res.status(200).send({
      message: "Vendor Expenses Report saved successfully",
      reportId: reportId,
      totalAmount: totalAmount,
      reportBasis: header.ReportBasis,
      startPeriod: header.StartPeriod,
      endPeriod: header.EndPeriod,
      totalRows: reportData.Rows.Row.length,
      columnsCount: columns.Column?.length || 0
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).send({ 
      error: "Error saving vendor expenses report", 
      details: err.message 
    });
  } finally {
    client.release();
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
