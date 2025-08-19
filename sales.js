const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
app.use(bodyParser.json());

// Customer Sales API
app.post("/customer-sales", async (req, res) => {
  const salesData = req.body;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Extract header information
    const header = salesData.Header || {};
    const reportTime = header.Time;
    const reportName = header.ReportName;
    const reportBasis = header.ReportBasis;
    const startPeriod = header.StartPeriod;
    const endPeriod = header.EndPeriod;
    const summarizeColumnsBy = header.SummarizeColumnsBy;
    const currency = header.Currency;
    const dateMacro = header.DateMacro;
    const noReportData =
      header.Option?.find((opt) => opt.Name === "NoReportData")?.Value ===
      "true";

    // Insert header information
    await client.query(
      `INSERT INTO customer_sales (
        report_name, report_basis, start_period, end_period, summarize_columns_by,
        currency, date_macro, report_time, no_report_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )`,
      [
        reportName,
        reportBasis,
        startPeriod ? new Date(startPeriod) : null,
        endPeriod ? new Date(endPeriod) : null,
        summarizeColumnsBy,
        currency,
        dateMacro,
        reportTime ? new Date(reportTime) : null,
        noReportData,
      ]
    );

    // Extract row data if available
    if (salesData.Rows && salesData.Rows.Row) {
      console.log("Processing rows:", salesData.Rows.Row.length);

      for (const row of salesData.Rows.Row) {
        // Skip summary rows
        if (row.group === "GrandTotal") {
          console.log("Skipping GrandTotal row");
          continue;
        }

        if (row.ColData && row.ColData.length > 0) {
          const customerName = row.ColData[0]?.value || null;
          const totalAmount = row.ColData[1]?.value
            ? parseFloat(row.ColData[1].value)
            : null;

          console.log("Processing row:", { customerName, totalAmount });

          // Insert row data
          await client.query(
            `INSERT INTO customer_sales (
              report_name, report_basis, start_period, end_period, summarize_columns_by,
              currency, date_macro, report_time, no_report_data, customer_name, total_amount
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            )`,
            [
              reportName,
              reportBasis,
              startPeriod ? new Date(startPeriod) : null,
              endPeriod ? new Date(endPeriod) : null,
              summarizeColumnsBy,
              currency,
              dateMacro,
              reportTime ? new Date(reportTime) : null,
              noReportData,
              customerName,
              totalAmount,
            ]
          );
        }
      }
    }

    await client.query("COMMIT");
    res.status(200).send({
      message: "Customer sales data saved successfully",
      report_name: reportName,
      total_rows:
        salesData.Rows?.Row?.filter((row) => row.group !== "GrandTotal")
          .length || 0,
      header_data: {
        report_name: reportName,
        start_period: startPeriod,
        end_period: endPeriod,
        currency: currency,
        report_basis: reportBasis,
        date_macro: dateMacro,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error in customer-sales:", err);
    res
      .status(500)
      .send({
        error: "Failed to save customer sales data",
        details: err.message,
      });
  } finally {
    client.release();
  }
});

// Class Sales API
app.post("/class-sales", async (req, res) => {
  const salesData = req.body;
  console.log("Received ClassSales data:", JSON.stringify(salesData, null, 2));
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Extract header information
    const header = salesData.Header || {};
    const reportTime = header.Time;
    const reportName = header.ReportName;
    const reportBasis = header.ReportBasis;
    const startPeriod = header.StartPeriod;
    const endPeriod = header.EndPeriod;
    const summarizeColumnsBy = header.SummarizeColumnsBy;
    const currency = header.Currency;
    const dateMacro = header.DateMacro;
    const noReportData =
      header.Option?.find((opt) => opt.Name === "NoReportData")?.Value ===
      "true";

    console.log("Extracted header data:", {
      reportName,
      reportBasis,
      startPeriod,
      endPeriod,
      summarizeColumnsBy,
      currency,
      dateMacro,
      reportTime,
      noReportData,
    });

    // Insert header information
    await client.query(
      `INSERT INTO class_sales (
        report_name, report_basis, start_period, end_period, summarize_columns_by,
        currency, date_macro, report_time, no_report_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )`,
      [
        reportName,
        reportBasis,
        startPeriod ? new Date(startPeriod) : null,
        endPeriod ? new Date(endPeriod) : null,
        summarizeColumnsBy,
        currency,
        dateMacro,
        reportTime ? new Date(reportTime) : null,
        noReportData,
      ]
    );

    // Extract row data if available
    if (salesData.Rows && salesData.Rows.Row) {
      console.log("Processing rows:", salesData.Rows.Row.length);

      for (const row of salesData.Rows.Row) {
        // Skip summary rows
        if (row.group === "GrandTotal") {
          console.log("Skipping GrandTotal row");
          continue;
        }

        if (row.ColData && row.ColData.length > 0) {
          const className = row.ColData[0]?.value || null;
          const totalAmount = row.ColData[1]?.value
            ? parseFloat(row.ColData[1].value)
            : null;

          console.log("Processing row:", { className, totalAmount });

          // Insert row data
          await client.query(
            `INSERT INTO class_sales (
              report_name, report_basis, start_period, end_period, summarize_columns_by,
              currency, date_macro, report_time, no_report_data, class_name, total_amount
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            )`,
            [
              reportName,
              reportBasis,
              startPeriod ? new Date(startPeriod) : null,
              endPeriod ? new Date(endPeriod) : null,
              summarizeColumnsBy,
              currency,
              dateMacro,
              reportTime ? new Date(reportTime) : null,
              noReportData,
              className,
              totalAmount,
            ]
          );
        }
      }
    }

    await client.query("COMMIT");
    res.status(200).send({
      message: "Class sales data saved successfully",
      report_name: reportName,
      total_rows:
        salesData.Rows?.Row?.filter((row) => row.group !== "GrandTotal")
          .length || 0,
      header_data: {
        report_name: reportName,
        start_period: startPeriod,
        end_period: endPeriod,
        currency: currency,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error in class-sales:", err);
    res
      .status(500)
      .send({ error: "Failed to save class sales data", details: err.message });
  } finally {
    client.release();
  }
});

// Department Sales API
app.post("/department-sales", async (req, res) => {
  const salesData = req.body;
  console.log(
    "Received DepartmentSales data:",
    JSON.stringify(salesData, null, 2)
  );
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Extract header information
    const header = salesData.Header || {};
    const reportTime = header.Time;
    const reportName = header.ReportName;
    const reportBasis = header.ReportBasis;
    const startPeriod = header.StartPeriod;
    const endPeriod = header.EndPeriod;
    const summarizeColumnsBy = header.SummarizeColumnsBy;
    const currency = header.Currency;
    const dateMacro = header.DateMacro;
    const noReportData =
      header.Option?.find((opt) => opt.Name === "NoReportData")?.Value ===
      "true";

    console.log("Extracted header data:", {
      reportName,
      reportBasis,
      startPeriod,
      endPeriod,
      summarizeColumnsBy,
      currency,
      dateMacro,
      reportTime,
      noReportData,
    });

    // Insert header information
    await client.query(
      `INSERT INTO department_sales (
        report_name, report_basis, start_period, end_period, summarize_columns_by,
        currency, date_macro, report_time, no_report_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )`,
      [
        reportName,
        reportBasis,
        startPeriod ? new Date(startPeriod) : null,
        endPeriod ? new Date(endPeriod) : null,
        summarizeColumnsBy,
        currency,
        dateMacro,
        reportTime ? new Date(reportTime) : null,
        noReportData,
      ]
    );

    // Extract row data if available
    if (salesData.Rows && salesData.Rows.Row) {
      console.log("Processing rows:", salesData.Rows.Row.length);

      for (const row of salesData.Rows.Row) {
        // Skip summary rows
        if (row.group === "GrandTotal") {
          console.log("Skipping GrandTotal row");
          continue;
        }

        if (row.ColData && row.ColData.length > 0) {
          const departmentName = row.ColData[0]?.value || null;
          const totalAmount = row.ColData[1]?.value
            ? parseFloat(row.ColData[1].value)
            : null;

          console.log("Processing row:", { departmentName, totalAmount });

          // Insert row data
          await client.query(
            `INSERT INTO department_sales (
              report_name, report_basis, start_period, end_period, summarize_columns_by,
              currency, date_macro, report_time, no_report_data, department_name, total_amount
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            )`,
            [
              reportName,
              reportBasis,
              startPeriod ? new Date(startPeriod) : null,
              endPeriod ? new Date(endPeriod) : null,
              summarizeColumnsBy,
              currency,
              dateMacro,
              reportTime ? new Date(reportTime) : null,
              noReportData,
              departmentName,
              totalAmount,
            ]
          );
        }
      }
    }

    await client.query("COMMIT");
    res.status(200).send({
      message: "Department sales data saved successfully",
      report_name: reportName,
      total_rows:
        salesData.Rows?.Row?.filter((row) => row.group !== "GrandTotal")
          .length || 0,
      header_data: {
        report_name: reportName,
        start_period: startPeriod,
        end_period: endPeriod,
        currency: currency,
        report_basis: reportBasis,
        date_macro: dateMacro,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error in department-sales:", err);
    res
      .status(500)
      .send({
        error: "Failed to save department sales data",
        details: err.message,
      });
  } finally {
    client.release();
  }
});

// Item Sales API
app.post("/item-sales", async (req, res) => {
  const salesData = req.body;
  console.log(
    "Received ItemSales data:",
    JSON.stringify(salesData, null, 2)
  );
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Extract header information
    const header = salesData.Header || {};
    const reportTime = header.Time;
    const reportName = header.ReportName;
    const reportBasis = header.ReportBasis;
    const startPeriod = header.StartPeriod;
    const endPeriod = header.EndPeriod;
    const summarizeColumnsBy = header.SummarizeColumnsBy;
    const currency = header.Currency;
    const dateMacro = header.DateMacro;
    const noReportData =
      header.Option?.find((opt) => opt.Name === "NoReportData")?.Value ===
      "true";

    console.log("Extracted header data:", {
      reportName,
      reportBasis,
      startPeriod,
      endPeriod,
      summarizeColumnsBy,
      currency,
      dateMacro,
      reportTime,
      noReportData,
    });

    // Insert header information
    await client.query(
      `INSERT INTO item_sales (
        report_name, report_basis, start_period, end_period, summarize_columns_by,
        currency, date_macro, report_time, no_report_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )`,
      [
        reportName,
        reportBasis,
        startPeriod ? new Date(startPeriod) : null,
        endPeriod ? new Date(endPeriod) : null,
        summarizeColumnsBy,
        currency,
        dateMacro,
        reportTime ? new Date(reportTime) : null,
        noReportData,
      ]
    );

    // Extract row data if available
    if (salesData.Rows && salesData.Rows.Row) {
      console.log("Processing rows:", salesData.Rows.Row.length);

      for (const row of salesData.Rows.Row) {
        // Skip summary rows
        if (row.group === "GrandTotal") {
          console.log("Skipping GrandTotal row");
          continue;
        }

        if (row.ColData && row.ColData.length > 0) {
          const itemName = row.ColData[0]?.value || null;
          const totalAmount = row.ColData[1]?.value
            ? parseFloat(row.ColData[1].value)
            : null;

          console.log("Processing row:", { itemName, totalAmount });

          // Insert row data
          await client.query(
            `INSERT INTO item_sales (
              report_name, report_basis, start_period, end_period, summarize_columns_by,
              currency, date_macro, report_time, no_report_data, item_name, total_amount
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            )`,
            [
              reportName,
              reportBasis,
              startPeriod ? new Date(startPeriod) : null,
              endPeriod ? new Date(endPeriod) : null,
              summarizeColumnsBy,
              currency,
              dateMacro,
              reportTime ? new Date(reportTime) : null,
              noReportData,
              itemName,
              totalAmount,
            ]
          );
        }
      }
    }

    await client.query("COMMIT");
    res.status(200).send({
      message: "Item sales data saved successfully",
      report_name: reportName,
      total_rows:
        salesData.Rows?.Row?.filter((row) => row.group !== "GrandTotal")
          .length || 0,
      header_data: {
        report_name: reportName,
        start_period: startPeriod,
        end_period: endPeriod,
        currency: currency,
        report_basis: reportBasis,
        date_macro: dateMacro,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error in item-sales:", err);
    res
      .status(500)
      .send({
        error: "Failed to save item sales data",
        details: err.message,
      });
  } finally {
    client.release();
  }
});

// Sales Receipt API
app.post("/sales-receipt", async (req, res) => {
  const receiptData = req.body;
  console.log(
    "Received SalesReceipt data:",
    JSON.stringify(receiptData, null, 2)
  );
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Process SalesReceipt data
    if (receiptData.QueryResponse && receiptData.QueryResponse.SalesReceipt) {
      const receipts = receiptData.QueryResponse.SalesReceipt;
      console.log("Processing receipts:", receipts.length);

      for (const receipt of receipts) {
        // Insert main receipt data
        const receiptResult = await client.query(
          `INSERT INTO sales_receipt (
            qb_id, sync_token, doc_number, txn_date, currency, total_amount,
            balance, tax_total, print_status, email_status, apply_tax_after_discount,
            free_form_address, ship_from_address, deposit_to_account, create_time, last_updated_time
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
          ) RETURNING id`,
          [
            receipt.Id,
            receipt.SyncToken,
            receipt.DocNumber,
            receipt.TxnDate ? new Date(receipt.TxnDate) : null,
            receipt.CurrencyRef?.value,
            receipt.TotalAmt,
            receipt.Balance,
            receipt.TxnTaxDetail?.TotalTax || 0,
            receipt.PrintStatus,
            receipt.EmailStatus,
            receipt.ApplyTaxAfterDiscount || false,
            receipt.FreeFormAddress || false,
            receipt.ShipFromAddr ? JSON.stringify(receipt.ShipFromAddr) : null,
            receipt.DepositToAccountRef?.name,
            receipt.MetaData?.CreateTime ? new Date(receipt.MetaData.CreateTime) : null,
            receipt.MetaData?.LastUpdatedTime ? new Date(receipt.MetaData.LastUpdatedTime) : null,
          ]
        );

        const receiptId = receiptResult.rows[0].id;

        // Process line items
        if (receipt.Line && Array.isArray(receipt.Line)) {
          for (const line of receipt.Line) {
            if (line.DetailType === "SalesItemLineDetail" && line.SalesItemLineDetail) {
              const detail = line.SalesItemLineDetail;
              
              await client.query(
                `INSERT INTO sales_receipt_lines (
                  receipt_id, line_id, line_num, description, amount, detail_type,
                  item_ref, item_name, unit_price, quantity, item_account_ref,
                  item_account_name, tax_code_ref
                ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
                )`,
                [
                  receiptId,
                  line.Id,
                  line.LineNum,
                  line.Description,
                  line.Amount,
                  line.DetailType,
                  detail.ItemRef?.value,
                  detail.ItemRef?.name,
                  detail.UnitPrice,
                  detail.Qty,
                  detail.ItemAccountRef?.value,
                  detail.ItemAccountRef?.name,
                  detail.TaxCodeRef?.value,
                ]
              );
            }
          }
        }
      }
    }

    await client.query("COMMIT");
    res.status(200).send({
      message: "Sales receipt data saved successfully",
      total_receipts: receiptData.QueryResponse?.SalesReceipt?.length || 0,
      time: receiptData.time,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error in sales-receipt:", err);
    res
      .status(500)
      .send({
        error: "Failed to save sales receipt data",
        details: err.message,
      });
  } finally {
    client.release();
  }
});

// Start the server
app.listen(5000, () => {
  console.log("Sales service running on port 5000");
});
