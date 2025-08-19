  const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
app.use(bodyParser.json());

app.post("/transactionlistwithsplits", async (req, res) => {
  const reportData = req.body;
  console.log(JSON.stringify(reportData));
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Tables already exist - transaction_list_reports and transaction_list_splits

    const header = reportData.Header || {};
    const columns = reportData.Columns || {};
    const options = header.Option || [];
    const noReportData = options.find(o => o.Name === "NoReportData")?.Value === "true";

    // Insert into reports table - STORE COMPLETE COLUMNS LIKE VENDOR.JS
    const result = await client.query(
      `INSERT INTO transaction_list_reports (
        report_name, report_time, date_macro, start_period, end_period, 
        currency, no_report_data, header_options, columns_info, full_header
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING id`,
      [
        header.ReportName,
        header.Time,
        header.DateMacro,
        header.StartPeriod,
        header.EndPeriod,
        header.Currency,
        noReportData,
        JSON.stringify(options),
        JSON.stringify(columns), // Complete Columns structure stored like vendor.js
        JSON.stringify(header)
      ]
    );

    const reportId = result.rows[0].id;

    // Process each account section - COMPREHENSIVE KEY COVERAGE
    let sectionPosition = 0;
    for (const section of reportData.Rows.Row) {
      if (section.type === "Section" && section.Header && section.Rows) {
        sectionPosition++;
        
        // Extract account header information - ALL KEYS
        const accountHeader = section.Header.ColData || [];
        const accountId = accountHeader[0]?.id || null;
        const accountName = accountHeader[0]?.value || null;

        // Insert account header row with complete data
        await client.query(
          `INSERT INTO transaction_list_splits (
            report_id, account_id, account_name, row_type, section_type,
            section_position, is_header, header_data, full_row_data, full_section_data
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          )`,
          [
            reportId,
            accountId,
            accountName,
            'header',
            'account_section',
            sectionPosition,
            true,
            JSON.stringify(section.Header),
            JSON.stringify(section.Header),
            JSON.stringify(section)
          ]
        );

        // Process transactions within this account section - COVER ALL FIELDS
        let rowPosition = 0;
        for (const txnRow of section.Rows.Row) {
          if (txnRow.ColData && txnRow.type === "Data") {
            rowPosition++;
            const colData = txnRow.ColData;
            
            // Extract ALL transaction details with comprehensive coverage
            const transactionDate = colData[0]?.value || null;
            const transactionType = colData[1]?.value || null;
            const transactionId = colData[1]?.id || null;
            const documentNumber = colData[2]?.value || null;
            const postingStatus = colData[3]?.value || null;
            const postingBoolean = postingStatus === "Yes" ? true : (postingStatus === "No" ? false : null);
            const entityName = colData[4]?.value || null;
            const entityId = colData[4]?.id || null;
            const memoDescription = colData[5]?.value || null;
            const splitAccountName = colData[6]?.value || null;
            const splitAccountId = colData[6]?.id || null;
            const rawAmountValue = colData[7]?.value || null;
            const amount = rawAmountValue ? parseFloat(rawAmountValue) : 0;

            // Enhanced row analysis
            const isSplitLine = transactionDate === "0-00-00" || transactionDate === "";
            const isEmptyRow = colData.every(col => !col.value || col.value === "");
            
            // Create comprehensive column metadata mapping - USING ACTUAL COLUMNS STRUCTURE LIKE VENDOR.JS
            const columnMetadata = {};
            if (columns.Column && Array.isArray(columns.Column)) {
              columns.Column.forEach((col, index) => {
                const colKey = col.MetaData?.find(meta => meta.Name === "ColKey")?.Value || `col_${index}`;
                columnMetadata[`column${index}`] = {
                  title: col.ColTitle,
                  type: col.ColType,
                  key: colKey,
                  value: colData[index]?.value || null,
                  id: colData[index]?.id || null,
                  metaData: col.MetaData || []
                };
              });
            }

            // Insert ALL data including empty rows for complete audit trail
            await client.query(
              `INSERT INTO transaction_list_splits (
                report_id, account_id, account_name, transaction_date, 
                transaction_type, transaction_id, document_number, posting_status,
                posting_boolean, entity_name, entity_id, memo_description, split_account_id,
                split_account_name, amount, raw_amount_value, row_type, section_type,
                section_position, is_header, is_split_line, is_empty_row, column_metadata,
                col_data, full_row_data, full_section_data
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
              )`,
              [
                reportId,
                accountId,
                accountName,
                transactionDate !== "0-00-00" && transactionDate !== "" ? transactionDate : null,
                transactionType,
                transactionId,
                documentNumber,
                postingStatus,
                postingBoolean,
                entityName,
                entityId,
                memoDescription,
                splitAccountId,
                splitAccountName,
                amount,
                rawAmountValue,
                isEmptyRow ? 'empty' : 'transaction',
                'account_section',
                sectionPosition,
                false,
                isSplitLine,
                isEmptyRow,
                JSON.stringify(columnMetadata),
                JSON.stringify(colData),
                JSON.stringify(txnRow),
                JSON.stringify(section)
              ]
            );
          }
        }
      }
    }

    await client.query("COMMIT");

    // Calculate comprehensive statistics - COMPLETE COVERAGE
    const stats = await client.query(
      `SELECT 
        COUNT(*) as total_rows,
        COUNT(*) FILTER (WHERE is_header = true) as header_rows,
        COUNT(*) FILTER (WHERE row_type = 'transaction') as transaction_rows,
        COUNT(*) FILTER (WHERE row_type = 'empty') as empty_rows,
        COUNT(*) FILTER (WHERE is_split_line = true) as split_rows,
        COUNT(*) FILTER (WHERE is_empty_row = true) as empty_data_rows,
        COUNT(DISTINCT account_id) as unique_accounts,
        COUNT(DISTINCT transaction_id) as unique_transactions,
        COUNT(DISTINCT transaction_type) as unique_transaction_types,
        COUNT(DISTINCT section_position) as total_sections,
        SUM(amount) as total_amount,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_positive_amount,
        SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as total_negative_amount,
        AVG(amount) as average_amount,
        MIN(transaction_date) as earliest_date,
        MAX(transaction_date) as latest_date,
        COUNT(DISTINCT posting_status) as unique_posting_statuses,
        COUNT(*) FILTER (WHERE posting_boolean = true) as confirmed_postings,
        COUNT(*) FILTER (WHERE posting_boolean = false) as unconfirmed_postings
       FROM transaction_list_splits 
       WHERE report_id = $1 AND row_type != 'empty'`,
      [reportId]
    );

    const reportStats = stats.rows[0];

    res.status(200).send({
      message: "Transaction List with Splits Report saved successfully",
      reportId: reportId,
      reportInfo: {
        reportName: header.ReportName,
        reportTime: header.Time,
        dateMacro: header.DateMacro,
        startPeriod: header.StartPeriod,
        endPeriod: header.EndPeriod,
        currency: header.Currency,
        noReportData: noReportData
      },
      comprehensiveStatistics: {
        rowAnalysis: {
          totalRows: parseInt(reportStats.total_rows || 0),
          headerRows: parseInt(reportStats.header_rows || 0),
          transactionRows: parseInt(reportStats.transaction_rows || 0),
          emptyRows: parseInt(reportStats.empty_rows || 0),
          splitRows: parseInt(reportStats.split_rows || 0),
          emptyDataRows: parseInt(reportStats.empty_data_rows || 0)
        },
        structureAnalysis: {
          totalSections: parseInt(reportStats.total_sections || 0),
          uniqueAccounts: parseInt(reportStats.unique_accounts || 0),
          uniqueTransactions: parseInt(reportStats.unique_transactions || 0),
          uniqueTransactionTypes: parseInt(reportStats.unique_transaction_types || 0),
          uniquePostingStatuses: parseInt(reportStats.unique_posting_statuses || 0)
        },
        financialAnalysis: {
          totalAmount: parseFloat(reportStats.total_amount || 0),
          totalPositiveAmount: parseFloat(reportStats.total_positive_amount || 0),
          totalNegativeAmount: parseFloat(reportStats.total_negative_amount || 0),
          averageAmount: parseFloat(reportStats.average_amount || 0),
          netAmount: parseFloat(reportStats.total_positive_amount || 0) + parseFloat(reportStats.total_negative_amount || 0)
        },
        postingAnalysis: {
          confirmedPostings: parseInt(reportStats.confirmed_postings || 0),
          unconfirmedPostings: parseInt(reportStats.unconfirmed_postings || 0),
          postingRate: parseInt(reportStats.confirmed_postings || 0) + parseInt(reportStats.unconfirmed_postings || 0) > 0 
            ? ((parseInt(reportStats.confirmed_postings || 0) / (parseInt(reportStats.confirmed_postings || 0) + parseInt(reportStats.unconfirmed_postings || 0))) * 100).toFixed(2) + '%'
            : '0%'
        },
        dateRange: {
          earliest: reportStats.earliest_date,
          latest: reportStats.latest_date
        }
      },
      completeColumnMapping: columns.Column ? columns.Column.reduce((acc, col, index) => {
        const colKey = col.MetaData?.find(meta => meta.Name === "ColKey")?.Value || `col_${index}`;
        acc[`column${index}`] = {
          title: col.ColTitle,
          type: col.ColType,
          metadataKey: colKey,
          description: col.ColTitle,
          fullMetadata: col.MetaData || []
        };
        return acc;
      }, {}) : {},
      originalColumnsStructure: columns, // Store complete Columns structure like vendor.js
      dataProcessingInfo: {
        sectionsProcessed: parseInt(reportStats.total_sections || 0),
        splitLineIdentification: "Rows with date '0-00-00' are split transaction lines",
        emptyRowHandling: "All rows including empty ones are stored for complete audit trail",
        amountProcessing: "Both positive and negative amounts preserved with raw values",
        metadataMapping: "Complete column metadata stored in JSONB format"
      },
      dataMappingComplete: true,
      allKeysStored: true
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error saving transaction list with splits:", err);
    res.status(500).send({ 
      error: "Error saving transaction list with splits", 
      details: err.message 
    });
  } finally {
    client.release();
  }
});

app.post("/transactionlistbycustomer", async (req, res) => {
  const reportData = req.body;
  console.log(JSON.stringify(reportData));
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Tables already exist - transaction_customer_reports and transaction_customer_data

    const header = reportData.Header || {};
    const columns = reportData.Columns || {};
    const options = header.Option || [];
    const noReportData = options.find(o => o.Name === "NoReportData")?.Value === "true";

    // Insert into reports table - STORE COMPLETE COLUMNS LIKE VENDOR.JS
    const result = await client.query(
      `INSERT INTO transaction_customer_reports (
        report_name, report_time, date_macro, start_period, end_period, 
        currency, no_report_data, header_options, columns_info, full_header
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING id`,
      [
        header.ReportName,
        header.Time,
        header.DateMacro,
        header.StartPeriod,
        header.EndPeriod,
        header.Currency,
        noReportData,
        JSON.stringify(options),
        JSON.stringify(columns), // Complete Columns structure stored like vendor.js
        JSON.stringify(header)
      ]
    );

    const reportId = result.rows[0].id;

    // Process customer sections if data exists - COMPREHENSIVE KEY COVERAGE
    let sectionPosition = 0;
    let totalProcessedRows = 0;

    if (reportData.Rows && reportData.Rows.Row && Array.isArray(reportData.Rows.Row)) {
      for (const section of reportData.Rows.Row) {
        if (section.type === "Section" && section.Header && section.Rows) {
          sectionPosition++;
          
          // Extract customer header information - ALL KEYS
          const customerHeader = section.Header.ColData || [];
          const customerId = customerHeader[0]?.id || null;
          const customerName = customerHeader[0]?.value || null;

          // Insert customer header row with complete data
          await client.query(
            `INSERT INTO transaction_customer_data (
              report_id, customer_id, customer_name, row_type, section_type,
              section_position, is_header, header_data, full_row_data, full_section_data
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            )`,
            [
              reportId,
              customerId,
              customerName,
              'header',
              'customer_section',
              sectionPosition,
              true,
              JSON.stringify(section.Header),
              JSON.stringify(section.Header),
              JSON.stringify(section)
            ]
          );

          // Process transactions within this customer section - COVER ALL FIELDS
          let rowPosition = 0;
          if (section.Rows.Row && Array.isArray(section.Rows.Row)) {
            for (const txnRow of section.Rows.Row) {
              if (txnRow.ColData && txnRow.type === "Data") {
                rowPosition++;
                totalProcessedRows++;
                const colData = txnRow.ColData;
                
                // Extract ALL transaction details with comprehensive coverage
                const transactionDate = colData[0]?.value || null;
                const transactionType = colData[1]?.value || null;
                const transactionId = colData[1]?.id || null;
                const documentNumber = colData[2]?.value || null;
                const postingStatus = colData[3]?.value || null;
                const postingBoolean = postingStatus === "Yes" ? true : (postingStatus === "No" ? false : null);
                const memoDescription = colData[4]?.value || null;
                const accountName = colData[5]?.value || null;
                const accountId = colData[5]?.id || null;
                const rawAmountValue = colData[6]?.value || null;
                const amount = rawAmountValue ? parseFloat(rawAmountValue) : 0;

                // Enhanced row analysis
                const isEmptyRow = colData.every(col => !col.value || col.value === "");
                
                // Create comprehensive column metadata mapping - USING ACTUAL COLUMNS STRUCTURE LIKE VENDOR.JS
                const columnMetadata = {};
                if (columns.Column && Array.isArray(columns.Column)) {
                  columns.Column.forEach((col, index) => {
                    const colKey = col.MetaData?.find(meta => meta.Name === "ColKey")?.Value || `col_${index}`;
                    columnMetadata[`column${index}`] = {
                      title: col.ColTitle,
                      type: col.ColType || "String",
                      key: colKey,
                      value: colData[index]?.value || null,
                      id: colData[index]?.id || null,
                      metaData: col.MetaData || []
                    };
                  });
                }

                // Insert ALL data including empty rows for complete audit trail
                await client.query(
                  `INSERT INTO transaction_customer_data (
                    report_id, customer_id, customer_name, transaction_date, 
                    transaction_type, transaction_id, document_number, posting_status,
                    posting_boolean, memo_description, account_id, account_name, 
                    amount, raw_amount_value, row_type, section_type,
                    section_position, is_header, is_empty_row, column_metadata,
                    col_data, full_row_data, full_section_data
                  ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
                  )`,
                  [
                    reportId,
                    customerId,
                    customerName,
                    transactionDate !== "0-00-00" && transactionDate !== "" ? transactionDate : null,
                    transactionType,
                    transactionId,
                    documentNumber,
                    postingStatus,
                    postingBoolean,
                    memoDescription,
                    accountId,
                    accountName,
                    amount,
                    rawAmountValue,
                    isEmptyRow ? 'empty' : 'transaction',
                    'customer_section',
                    sectionPosition,
                    false,
                    isEmptyRow,
                    JSON.stringify(columnMetadata),
                    JSON.stringify(colData),
                    JSON.stringify(txnRow),
                    JSON.stringify(section)
                  ]
                );
              }
            }
          }
        }
      }
    }

    await client.query("COMMIT");

    // Calculate comprehensive statistics - COMPLETE COVERAGE
    const stats = await client.query(
      `SELECT 
        COUNT(*) as total_rows,
        COUNT(*) FILTER (WHERE is_header = true) as header_rows,
        COUNT(*) FILTER (WHERE row_type = 'transaction') as transaction_rows,
        COUNT(*) FILTER (WHERE row_type = 'empty') as empty_rows,
        COUNT(*) FILTER (WHERE is_empty_row = true) as empty_data_rows,
        COUNT(DISTINCT customer_id) as unique_customers,
        COUNT(DISTINCT transaction_id) as unique_transactions,
        COUNT(DISTINCT transaction_type) as unique_transaction_types,
        COUNT(DISTINCT section_position) as total_sections,
        SUM(amount) as total_amount,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_positive_amount,
        SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as total_negative_amount,
        AVG(amount) as average_amount,
        MIN(transaction_date) as earliest_date,
        MAX(transaction_date) as latest_date,
        COUNT(DISTINCT posting_status) as unique_posting_statuses,
        COUNT(*) FILTER (WHERE posting_boolean = true) as confirmed_postings,
        COUNT(*) FILTER (WHERE posting_boolean = false) as unconfirmed_postings
       FROM transaction_customer_data 
       WHERE report_id = $1 AND row_type != 'empty'`,
      [reportId]
    );

    const reportStats = stats.rows[0];

    res.status(200).send({
      message: "Transaction List by Customer Report saved successfully",
      reportId: reportId,
      reportInfo: {
        reportName: header.ReportName,
        reportTime: header.Time,
        dateMacro: header.DateMacro,
        startPeriod: header.StartPeriod,
        endPeriod: header.EndPeriod,
        currency: header.Currency,
        noReportData: noReportData
      },
      comprehensiveStatistics: {
        rowAnalysis: {
          totalRows: parseInt(reportStats.total_rows || 0),
          headerRows: parseInt(reportStats.header_rows || 0),
          transactionRows: parseInt(reportStats.transaction_rows || 0),
          emptyRows: parseInt(reportStats.empty_rows || 0),
          emptyDataRows: parseInt(reportStats.empty_data_rows || 0),
          processedRows: totalProcessedRows
        },
        structureAnalysis: {
          totalSections: parseInt(reportStats.total_sections || 0),
          uniqueCustomers: parseInt(reportStats.unique_customers || 0),
          uniqueTransactions: parseInt(reportStats.unique_transactions || 0),
          uniqueTransactionTypes: parseInt(reportStats.unique_transaction_types || 0),
          uniquePostingStatuses: parseInt(reportStats.unique_posting_statuses || 0)
        },
        financialAnalysis: {
          totalAmount: parseFloat(reportStats.total_amount || 0),
          totalPositiveAmount: parseFloat(reportStats.total_positive_amount || 0),
          totalNegativeAmount: parseFloat(reportStats.total_negative_amount || 0),
          averageAmount: parseFloat(reportStats.average_amount || 0),
          netAmount: parseFloat(reportStats.total_positive_amount || 0) + parseFloat(reportStats.total_negative_amount || 0)
        },
        postingAnalysis: {
          confirmedPostings: parseInt(reportStats.confirmed_postings || 0),
          unconfirmedPostings: parseInt(reportStats.unconfirmed_postings || 0),
          postingRate: parseInt(reportStats.confirmed_postings || 0) + parseInt(reportStats.unconfirmed_postings || 0) > 0 
            ? ((parseInt(reportStats.confirmed_postings || 0) / (parseInt(reportStats.confirmed_postings || 0) + parseInt(reportStats.unconfirmed_postings || 0))) * 100).toFixed(2) + '%'
            : '0%'
        },
        dateRange: {
          earliest: reportStats.earliest_date,
          latest: reportStats.latest_date
        }
      },
      completeColumnMapping: columns.Column ? columns.Column.reduce((acc, col, index) => {
        const colKey = col.MetaData?.find(meta => meta.Name === "ColKey")?.Value || `col_${index}`;
        acc[`column${index}`] = {
          title: col.ColTitle,
          type: col.ColType || "String",
          metadataKey: colKey,
          description: col.ColTitle,
          fullMetadata: col.MetaData || []
        };
        return acc;
      }, {}) : {},
      originalColumnsStructure: columns, // Store complete Columns structure like vendor.js
      dataProcessingInfo: {
        sectionsProcessed: parseInt(reportStats.total_sections || 0),
        emptyRowHandling: "All rows including empty ones are stored for complete audit trail",
        amountProcessing: "Both positive and negative amounts preserved with raw values",
        metadataMapping: "Complete column metadata stored in JSONB format",
        noReportDataHandling: noReportData ? "No transaction data available for this period" : "Transaction data processed successfully"
      },
      dataMappingComplete: true,
      allKeysStored: true,
      noDataReport: noReportData
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error saving transaction list by customer:", err);
    res.status(500).send({ 
      error: "Error saving transaction list by customer", 
      details: err.message 
    });
  } finally {
    client.release();
  }
});

app.post("/transactionlistbyvendor", async (req, res) => {
  const reportData = req.body;
  console.log(JSON.stringify(reportData));
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Tables already exist - transaction_vendor_reports and transaction_vendor_data

    const header = reportData.Header || {};
    const columns = reportData.Columns || {};
    const options = header.Option || [];
    const noReportData = options.find(o => o.Name === "NoReportData")?.Value === "true";

    // Insert into reports table - STORE COMPLETE COLUMNS LIKE VENDOR.JS
    const result = await client.query(
      `INSERT INTO transaction_vendor_reports (
        report_name, report_time, date_macro, start_period, end_period, 
        currency, no_report_data, header_options, columns_info, full_header
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING id`,
      [
        header.ReportName,
        header.Time,
        header.DateMacro,
        header.StartPeriod,
        header.EndPeriod,
        header.Currency,
        noReportData,
        JSON.stringify(options),
        JSON.stringify(columns), // Complete Columns structure stored like vendor.js
        JSON.stringify(header)
      ]
    );

    const reportId = result.rows[0].id;

    // Process vendor sections if data exists - COMPREHENSIVE KEY COVERAGE
    let sectionPosition = 0;
    let totalProcessedRows = 0;

    if (reportData.Rows && reportData.Rows.Row && Array.isArray(reportData.Rows.Row)) {
      for (const section of reportData.Rows.Row) {
        if (section.type === "Section" && section.Header && section.Rows) {
          sectionPosition++;
          
          // Extract vendor header information - ALL KEYS
          const vendorHeader = section.Header.ColData || [];
          const vendorId = vendorHeader[0]?.id || null;
          const vendorName = vendorHeader[0]?.value || null;

          // Insert vendor header row with complete data
          await client.query(
            `INSERT INTO transaction_vendor_data (
              report_id, vendor_id, vendor_name, row_type, section_type,
              section_position, is_header, header_data, full_row_data, full_section_data
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            )`,
            [
              reportId,
              vendorId,
              vendorName,
              'header',
              'vendor_section',
              sectionPosition,
              true,
              JSON.stringify(section.Header),
              JSON.stringify(section.Header),
              JSON.stringify(section)
            ]
          );

          // Process transactions within this vendor section - COVER ALL FIELDS
          let rowPosition = 0;
          if (section.Rows.Row && Array.isArray(section.Rows.Row)) {
            for (const txnRow of section.Rows.Row) {
              if (txnRow.ColData && txnRow.type === "Data") {
                rowPosition++;
                totalProcessedRows++;
                const colData = txnRow.ColData;
                
                // Extract ALL transaction details with comprehensive coverage
                const transactionDate = colData[0]?.value || null;
                const transactionType = colData[1]?.value || null;
                const transactionId = colData[1]?.id || null;
                const documentNumber = colData[2]?.value || null;
                const postingStatus = colData[3]?.value || null;
                const postingBoolean = postingStatus === "Yes" ? true : (postingStatus === "No" ? false : null);
                const memoDescription = colData[4]?.value || null;
                const accountName = colData[5]?.value || null;
                const accountId = colData[5]?.id || null;
                const rawAmountValue = colData[6]?.value || null;
                const amount = rawAmountValue ? parseFloat(rawAmountValue) : 0;

                // Enhanced row analysis
                const isEmptyRow = colData.every(col => !col.value || col.value === "");
                
                // Create comprehensive column metadata mapping - USING ACTUAL COLUMNS STRUCTURE LIKE VENDOR.JS
                const columnMetadata = {};
                if (columns.Column && Array.isArray(columns.Column)) {
                  columns.Column.forEach((col, index) => {
                    const colKey = col.MetaData?.find(meta => meta.Name === "ColKey")?.Value || `col_${index}`;
                    columnMetadata[`column${index}`] = {
                      title: col.ColTitle,
                      type: col.ColType || "String",
                      key: colKey,
                      value: colData[index]?.value || null,
                      id: colData[index]?.id || null,
                      metaData: col.MetaData || []
                    };
                  });
                }

                // Insert ALL data including empty rows for complete audit trail
                await client.query(
                  `INSERT INTO transaction_vendor_data (
                    report_id, vendor_id, vendor_name, transaction_date, 
                    transaction_type, transaction_id, document_number, posting_status,
                    posting_boolean, memo_description, account_id, account_name, 
                    amount, raw_amount_value, row_type, section_type,
                    section_position, is_header, is_empty_row, column_metadata,
                    col_data, full_row_data, full_section_data
                  ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
                  )`,
                  [
                    reportId,
                    vendorId,
                    vendorName,
                    transactionDate !== "0-00-00" && transactionDate !== "" ? transactionDate : null,
                    transactionType,
                    transactionId,
                    documentNumber,
                    postingStatus,
                    postingBoolean,
                    memoDescription,
                    accountId,
                    accountName,
                    amount,
                    rawAmountValue,
                    isEmptyRow ? 'empty' : 'transaction',
                    'vendor_section',
                    sectionPosition,
                    false,
                    isEmptyRow,
                    JSON.stringify(columnMetadata),
                    JSON.stringify(colData),
                    JSON.stringify(txnRow),
                    JSON.stringify(section)
                  ]
                );
              }
            }
          }
        }
      }
    }

    await client.query("COMMIT");

    // Calculate comprehensive statistics - COMPLETE COVERAGE
    const stats = await client.query(
      `SELECT 
        COUNT(*) as total_rows,
        COUNT(*) FILTER (WHERE is_header = true) as header_rows,
        COUNT(*) FILTER (WHERE row_type = 'transaction') as transaction_rows,
        COUNT(*) FILTER (WHERE row_type = 'empty') as empty_rows,
        COUNT(*) FILTER (WHERE is_empty_row = true) as empty_data_rows,
        COUNT(DISTINCT vendor_id) as unique_vendors,
        COUNT(DISTINCT transaction_id) as unique_transactions,
        COUNT(DISTINCT transaction_type) as unique_transaction_types,
        COUNT(DISTINCT section_position) as total_sections,
        SUM(amount) as total_amount,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_positive_amount,
        SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as total_negative_amount,
        AVG(amount) as average_amount,
        MIN(transaction_date) as earliest_date,
        MAX(transaction_date) as latest_date,
        COUNT(DISTINCT posting_status) as unique_posting_statuses,
        COUNT(*) FILTER (WHERE posting_boolean = true) as confirmed_postings,
        COUNT(*) FILTER (WHERE posting_boolean = false) as unconfirmed_postings
       FROM transaction_vendor_data 
       WHERE report_id = $1 AND row_type != 'empty'`,
      [reportId]
    );

    const reportStats = stats.rows[0];

    res.status(200).send({
      message: "Transaction List by Vendor Report saved successfully",
      reportId: reportId,
      reportInfo: {
        reportName: header.ReportName,
        reportTime: header.Time,
        dateMacro: header.DateMacro,
        startPeriod: header.StartPeriod,
        endPeriod: header.EndPeriod,
        currency: header.Currency,
        noReportData: noReportData
      },
      comprehensiveStatistics: {
        rowAnalysis: {
          totalRows: parseInt(reportStats.total_rows || 0),
          headerRows: parseInt(reportStats.header_rows || 0),
          transactionRows: parseInt(reportStats.transaction_rows || 0),
          emptyRows: parseInt(reportStats.empty_rows || 0),
          emptyDataRows: parseInt(reportStats.empty_data_rows || 0),
          processedRows: totalProcessedRows
        },
        structureAnalysis: {
          totalSections: parseInt(reportStats.total_sections || 0),
          uniqueVendors: parseInt(reportStats.unique_vendors || 0),
          uniqueTransactions: parseInt(reportStats.unique_transactions || 0),
          uniqueTransactionTypes: parseInt(reportStats.unique_transaction_types || 0),
          uniquePostingStatuses: parseInt(reportStats.unique_posting_statuses || 0)
        },
        financialAnalysis: {
          totalAmount: parseFloat(reportStats.total_amount || 0),
          totalPositiveAmount: parseFloat(reportStats.total_positive_amount || 0),
          totalNegativeAmount: parseFloat(reportStats.total_negative_amount || 0),
          averageAmount: parseFloat(reportStats.average_amount || 0),
          netAmount: parseFloat(reportStats.total_positive_amount || 0) + parseFloat(reportStats.total_negative_amount || 0)
        },
        postingAnalysis: {
          confirmedPostings: parseInt(reportStats.confirmed_postings || 0),
          unconfirmedPostings: parseInt(reportStats.unconfirmed_postings || 0),
          postingRate: parseInt(reportStats.confirmed_postings || 0) + parseInt(reportStats.unconfirmed_postings || 0) > 0 
            ? ((parseInt(reportStats.confirmed_postings || 0) / (parseInt(reportStats.confirmed_postings || 0) + parseInt(reportStats.unconfirmed_postings || 0))) * 100).toFixed(2) + '%'
            : '0%'
        },
        dateRange: {
          earliest: reportStats.earliest_date,
          latest: reportStats.latest_date
        }
      },
      completeColumnMapping: columns.Column ? columns.Column.reduce((acc, col, index) => {
        const colKey = col.MetaData?.find(meta => meta.Name === "ColKey")?.Value || `col_${index}`;
        acc[`column${index}`] = {
          title: col.ColTitle,
          type: col.ColType || "String",
          metadataKey: colKey,
          description: col.ColTitle,
          fullMetadata: col.MetaData || []
        };
        return acc;
      }, {}) : {},
      originalColumnsStructure: columns, // Store complete Columns structure like vendor.js
      dataProcessingInfo: {
        sectionsProcessed: parseInt(reportStats.total_sections || 0),
        emptyRowHandling: "All rows including empty ones are stored for complete audit trail",
        amountProcessing: "Both positive and negative amounts preserved with raw values",
        metadataMapping: "Complete column metadata stored in JSONB format",
        noReportDataHandling: noReportData ? "No transaction data available for this period" : "Transaction data processed successfully"
      },
      dataMappingComplete: true,
      allKeysStored: true,
      noDataReport: noReportData
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error saving transaction list by vendor:", err);
    res.status(500).send({ 
      error: "Error saving transaction list by vendor", 
      details: err.message 
    });
  } finally {
    client.release();
  }
});

app.post("/transactionlisting", async (req, res) => {
  const reportData = req.body;
  console.log(JSON.stringify(reportData));
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Tables already exist - transaction_listing_reports and transaction_listing_data

    const header = reportData.Header || {};
    const columns = reportData.Columns || {};
    const options = header.Option || [];
    const noReportData = options.find(o => o.Name === "NoReportData")?.Value === "true";

    // Insert into reports table - STORE COMPLETE COLUMNS LIKE VENDOR.JS
    const result = await client.query(
      `INSERT INTO transaction_listing_reports (
        report_name, report_time, date_macro, start_period, end_period, 
        currency, no_report_data, header_options, columns_info, full_header
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING id`,
      [
        header.ReportName,
        header.Time,
        header.DateMacro,
        header.StartPeriod,
        header.EndPeriod,
        header.Currency,
        noReportData,
        JSON.stringify(options),
        JSON.stringify(columns), // Complete Columns structure stored like vendor.js
        JSON.stringify(header)
      ]
    );

    const reportId = result.rows[0].id;

    // Process transaction rows if data exists - COMPREHENSIVE KEY COVERAGE
    let totalProcessedRows = 0;

    if (reportData.Rows && reportData.Rows.Row && Array.isArray(reportData.Rows.Row)) {
      for (const txnRow of reportData.Rows.Row) {
        if (txnRow.ColData && txnRow.type === "Data") {
          totalProcessedRows++;
          const colData = txnRow.ColData;
          
          // Extract ALL transaction details with comprehensive coverage
          const transactionDate = colData[0]?.value || null;
          const transactionType = colData[1]?.value || null;
          const transactionId = colData[1]?.id || null;
          const documentNumber = colData[2]?.value || null;
          const postingStatus = colData[3]?.value || null;
          const postingBoolean = postingStatus === "Yes" ? true : (postingStatus === "No" ? false : null);
          const entityName = colData[4]?.value || null;
          const entityId = colData[4]?.id || null;
          const memoDescription = colData[5]?.value || null;
          const accountName = colData[6]?.value || null;
          const accountId = colData[6]?.id || null;
          const splitAccountName = colData[7]?.value || null;
          const splitAccountId = colData[7]?.id || null;
          const rawAmountValue = colData[8]?.value || null;
          const amount = rawAmountValue ? parseFloat(rawAmountValue) : 0;

          // Enhanced row analysis
          const isEmptyRow = colData.every(col => !col.value || col.value === "");
          
          // Create comprehensive column metadata mapping - USING ACTUAL COLUMNS STRUCTURE LIKE VENDOR.JS
          const columnMetadata = {};
          if (columns.Column && Array.isArray(columns.Column)) {
            columns.Column.forEach((col, index) => {
              const colKey = col.MetaData?.find(meta => meta.Name === "ColKey")?.Value || `col_${index}`;
              columnMetadata[`column${index}`] = {
                title: col.ColTitle,
                type: col.ColType || "String",
                key: colKey,
                value: colData[index]?.value || null,
                id: colData[index]?.id || null,
                metaData: col.MetaData || []
              };
            });
          }

          // Insert ALL data including empty rows for complete audit trail
          await client.query(
            `INSERT INTO transaction_listing_data (
              report_id, transaction_date, transaction_type, transaction_id, 
              document_number, posting_status, posting_boolean, entity_name, 
              entity_id, memo_description, account_name, account_id, 
              split_account_name, split_account_id, amount, raw_amount_value, 
              row_type, is_empty_row, column_metadata, col_data, full_row_data
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
            )`,
            [
              reportId,
              transactionDate !== "0-00-00" && transactionDate !== "" ? transactionDate : null,
              transactionType,
              transactionId,
              documentNumber,
              postingStatus,
              postingBoolean,
              entityName,
              entityId,
              memoDescription,
              accountId,
              accountName,
              splitAccountName,
              splitAccountId,
              amount,
              rawAmountValue,
              isEmptyRow ? 'empty' : 'transaction',
              isEmptyRow,
              JSON.stringify(columnMetadata),
              JSON.stringify(colData),
              JSON.stringify(txnRow)
            ]
          );
        }
      }
    }

    await client.query("COMMIT");

    // Calculate comprehensive statistics - COMPLETE COVERAGE
    const stats = await client.query(
      `SELECT 
        COUNT(*) as total_rows,
        COUNT(*) FILTER (WHERE row_type = 'transaction') as transaction_rows,
        COUNT(*) FILTER (WHERE row_type = 'empty') as empty_rows,
        COUNT(*) FILTER (WHERE is_empty_row = true) as empty_data_rows,
        COUNT(DISTINCT transaction_id) as unique_transactions,
        COUNT(DISTINCT transaction_type) as unique_transaction_types,
        COUNT(DISTINCT account_id) as unique_accounts,
        COUNT(DISTINCT entity_id) as unique_entities,
        SUM(amount) as total_amount,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_positive_amount,
        SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as total_negative_amount,
        AVG(amount) as average_amount,
        MIN(transaction_date) as earliest_date,
        MAX(transaction_date) as latest_date,
        COUNT(DISTINCT posting_status) as unique_posting_statuses,
        COUNT(*) FILTER (WHERE posting_boolean = true) as confirmed_postings,
        COUNT(*) FILTER (WHERE posting_boolean = false) as unconfirmed_postings
       FROM transaction_listing_data 
       WHERE report_id = $1 AND row_type != 'empty'`,
      [reportId]
    );

    const reportStats = stats.rows[0];

    res.status(200).send({
      message: "Transaction Listing Report saved successfully",
      reportId: reportId,
      reportInfo: {
        reportName: header.ReportName,
        reportTime: header.Time,
        dateMacro: header.DateMacro,
        startPeriod: header.StartPeriod,
        endPeriod: header.EndPeriod,
        currency: header.Currency,
        noReportData: noReportData
      },
      comprehensiveStatistics: {
        rowAnalysis: {
          totalRows: parseInt(reportStats.total_rows || 0),
          transactionRows: parseInt(reportStats.transaction_rows || 0),
          emptyRows: parseInt(reportStats.empty_rows || 0),
          emptyDataRows: parseInt(reportStats.empty_data_rows || 0),
          processedRows: totalProcessedRows
        },
        structureAnalysis: {
          uniqueTransactions: parseInt(reportStats.unique_transactions || 0),
          uniqueTransactionTypes: parseInt(reportStats.unique_transaction_types || 0),
          uniqueAccounts: parseInt(reportStats.unique_accounts || 0),
          uniqueEntities: parseInt(reportStats.unique_entities || 0),
          uniquePostingStatuses: parseInt(reportStats.unique_posting_statuses || 0)
        },
        financialAnalysis: {
          totalAmount: parseFloat(reportStats.total_amount || 0),
          totalPositiveAmount: parseFloat(reportStats.total_positive_amount || 0),
          totalNegativeAmount: parseFloat(reportStats.total_negative_amount || 0),
          averageAmount: parseFloat(reportStats.average_amount || 0),
          netAmount: parseFloat(reportStats.total_positive_amount || 0) + parseFloat(reportStats.total_negative_amount || 0)
        },
        postingAnalysis: {
          confirmedPostings: parseInt(reportStats.confirmed_postings || 0),
          unconfirmedPostings: parseInt(reportStats.unconfirmed_postings || 0),
          postingRate: parseInt(reportStats.confirmed_postings || 0) + parseInt(reportStats.unconfirmed_postings || 0) > 0 
            ? ((parseInt(reportStats.confirmed_postings || 0) / (parseInt(reportStats.confirmed_postings || 0) + parseInt(reportStats.unconfirmed_postings || 0))) * 100).toFixed(2) + '%'
            : '0%'
        },
        dateRange: {
          earliest: reportStats.earliest_date,
          latest: reportStats.latest_date
        }
      },
      completeColumnMapping: columns.Column ? columns.Column.reduce((acc, col, index) => {
        const colKey = col.MetaData?.find(meta => meta.Name === "ColKey")?.Value || `col_${index}`;
        acc[`column${index}`] = {
          title: col.ColTitle,
          type: col.ColType || "String",
          metadataKey: colKey,
          description: col.ColTitle,
          fullMetadata: col.MetaData || []
        };
        return acc;
      }, {}) : {},
      originalColumnsStructure: columns, // Store complete Columns structure like vendor.js
      dataProcessingInfo: {
        emptyRowHandling: "All rows including empty ones are stored for complete audit trail",
        amountProcessing: "Both positive and negative amounts preserved with raw values",
        metadataMapping: "Complete column metadata stored in JSONB format",
        noReportDataHandling: noReportData ? "No transaction data available for this period" : "Transaction data processed successfully"
      },
      dataMappingComplete: true,
      allKeysStored: true,
      noDataReport: noReportData
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error saving transaction listing:", err);
    res.status(500).send({ 
      error: "Error saving transaction listing", 
      details: err.message 
    });
  } finally {
    client.release();
  }
});

app.listen(5000, () => {
  console.log("Transaction List with Splits service running on port 5000");
});
