const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const router = express.Router();
router.use(bodyParser.json());

// Input validation function
function validateLedgerData(ledger) {
  const requiredFields = ['report_name', 'account_id', 'txn_date', 'txn_type', 'doc_num'];
  const missingFields = requiredFields.filter(field => !ledger[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  return true;
}

// Optimized batch insert function
async function batchInsertGeneralLedgerData(tableName, ledgerArray, client) {
  if (ledgerArray.length === 0) return;
  
  // Use parameterized query with multiple value sets for better performance
  const values = [];
  const placeholders = [];
  let paramCount = 1;
  
  for (const ledger of ledgerArray) {
    const rowPlaceholders = [];
    for (let i = 0; i < 22; i++) {
      rowPlaceholders.push(`$${paramCount++}`);
    }
    placeholders.push(`(${rowPlaceholders.join(', ')})`);
    
    values.push(
      ledger.report_name || null,
      ledger.date_macro || null,
      ledger.report_basis || null,
      ledger.start_period || null,
      ledger.end_period || null,
      ledger.summarize_columns_by || null,
      ledger.currency || null,
      ledger.option_name || null,
      ledger.option_value || null,
      ledger.col_type || null,
      ledger.col_value || null,
      ledger.group_type || null,
      ledger.account_id || null,
      ledger.account_name || null,
      ledger.txn_date || null,
      ledger.txn_type || null,
      ledger.doc_num || null,
      ledger.name || null,
      ledger.memo || null,
      ledger.split_acc || null,
      ledger.amount || null,
      ledger.balance || null
    );
  }
  
  const query = `
    INSERT INTO ${tableName} (
      report_name, date_macro, report_basis, start_period, end_period,
      summarize_columns_by, currency, option_name, option_value,
      col_type, col_value, group_type,
      account_id, account_name, txn_date, txn_type,
      doc_num, name, memo, split_acc, amount, balance
    )
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (report_name, account_id, txn_date, txn_type, doc_num) DO UPDATE SET
      report_basis = EXCLUDED.report_basis,
      summarize_columns_by = EXCLUDED.summarize_columns_by,
      currency = EXCLUDED.currency,
      option_name = EXCLUDED.option_name,
      option_value = EXCLUDED.option_value,
      col_type = EXCLUDED.col_type,
      col_value = EXCLUDED.col_value,
      group_type = EXCLUDED.group_type,
      account_name = EXCLUDED.account_name,
      name = EXCLUDED.name,
      memo = EXCLUDED.memo,
      split_acc = EXCLUDED.split_acc,
      amount = EXCLUDED.amount,
      balance = EXCLUDED.balance
  `;
  
  await client.query(query, values);
}

// Main function for general ledger data insertion (from original general_ledger.js)
async function insertGeneralLedgerData(tableName, ledgerData, res) {
  const client = await pool.connect();
  
  try {
    // Validate input
    const ledgerArray = Array.isArray(ledgerData) ? ledgerData : [ledgerData];
    
    if (ledgerArray.length === 0) {
      return res.status(400).send({ error: 'No data provided' });
    }
    
    // Validate each record
    for (const ledger of ledgerArray) {
      try {
        validateLedgerData(ledger);
      } catch (validationError) {
        return res.status(400).send({ error: validationError.message });
      }
    }
    
    await client.query("BEGIN");
    
    // Use batch insert for better performance
    await batchInsertGeneralLedgerData(tableName, ledgerArray, client);
    
    await client.query("COMMIT");
    
    res.status(200).send({
      message: `${tableName.replace(/_/g, " ")} data saved successfully`,
      recordsProcessed: ledgerArray.length
    });
    
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`Error in ${tableName}:`, err);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to save general ledger data';
    if (err.code === '23505') { // Unique constraint violation
      errorMessage = 'Duplicate record detected';
    } else if (err.code === '23502') { // Not null constraint violation
      errorMessage = 'Required field missing';
    } else if (err.code === '42P01') { // Table doesn't exist
      errorMessage = 'Table not found';
    }
    
    res.status(500).send({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    client.release();
  }
}

// General Ledger endpoint (from original general_ledger.js)
router.post("/", (req, res) =>
  insertGeneralLedgerData("general_ledger", req.body, res)
);

// Alternative General Ledger API (from general-ledger.js)
router.post("/general-ledger", async (req, res) => {
  try {
    const report = req.body;

    const reportDate =
      report.Header.Option.find((opt) => opt.Name === "report_date")?.Value ||
      report.Header.EndPeriod;

    if (!reportDate)
      return res.status(400).json({ message: "Report date missing" });

    const rows = report.Rows.Row;
    const insertPromises = [];

    const processRow = (row, account = null, subSection = null) => {
      // Nested Rows (Sections)
      if (row.Rows && row.Rows.Row) {
        const currentAccount = row.Header?.ColData[0]?.value || account;
        row.Rows.Row.forEach((nestedRow) =>
          processRow(nestedRow, currentAccount, row.Header?.ColData[0]?.value)
        );
      }

      // Data Rows
      if (row.ColData) {
        const col = row.ColData;
        const tx_date = col[0]?.value || null;
        const txn_type = col[1]?.value || null;
        const doc_num = col[2]?.value || null;
        const name = col[3]?.value || null;
        const memo = col[4]?.value || null;
        const split = col[5]?.value || null;
        const amount = parseFloat(col[6]?.value) || 0;
        const balance = parseFloat(col[7]?.value) || 0;

        if (account) {
          insertPromises.push(
            pool.query(
              `INSERT INTO general_ledger
               (report_date, account_name, sub_section, tx_date, txn_type, doc_num, name, memo, split, amount, balance)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
               ON CONFLICT(report_date, account_name, sub_section, tx_date, txn_type, doc_num)
               DO UPDATE SET amount=EXCLUDED.amount, balance=EXCLUDED.balance, name=EXCLUDED.name, memo=EXCLUDED.memo, split=EXCLUDED.split`,
              [
                reportDate,
                account,
                subSection,
                tx_date,
                txn_type,
                doc_num,
                name,
                memo,
                split,
                amount,
                balance,
              ]
            )
          );
        }
      }

      // Summary Rows
      if (row.Summary && row.Summary.ColData) {
        const col = row.Summary.ColData;
        const tx_date = null;
        const txn_type = null;
        const doc_num = null;
        const name = null;
        const memo = null;
        const split = null;
        const amount = parseFloat(col[6]?.value) || 0;
        const balance = parseFloat(col[7]?.value) || 0;

        if (account) {
          insertPromises.push(
            pool.query(
              `INSERT INTO general_ledger
               (report_date, account_name, sub_section, tx_date, txn_type, doc_num, name, memo, split, amount, balance)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
               ON CONFLICT(report_date, account_name, sub_section, tx_date, txn_type, doc_num)
               DO UPDATE SET amount=EXCLUDED.amount, balance=EXCLUDED.balance`,
              [reportDate, account, subSection, tx_date, txn_type, doc_num, name, memo, split, amount, balance]
            )
          );
        }
      }
    };

    rows.forEach((row) => processRow(row));

    await Promise.all(insertPromises);

    res.json({ message: "General Ledger saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

module.exports = router;
