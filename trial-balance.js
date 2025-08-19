const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
app.use(bodyParser.json());

app.post("/trialbalance", async (req, res) => {
  const reportData = req.body;
  console.log(JSON.stringify(reportData));
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Validate that this is TrialBalance data
    if (!reportData.Rows || !reportData.Rows.Row) {
      return res.status(400).send({
        error: "Invalid data structure for trial balance report",
        message: "Expected structure with Rows.Row property."
      });
    }

    // Tables already exist - trial_balance_reports and trial_balance_accounts

    const header = reportData.Header || {};
    const columns = reportData.Columns || {};
    const options = header.Option || [];
    const noReportData = options.find(o => o.Name === "NoReportData")?.Value === "true";

    // Find grand total row
    const grandTotalRow = reportData.Rows.Row.find(r => r.group === "TOTAL" || r.Summary);
    const totalDebit = parseFloat(grandTotalRow?.Summary?.ColData?.[1]?.value) || 0;
    const totalCredit = parseFloat(grandTotalRow?.Summary?.ColData?.[2]?.value) || 0;

    // Insert into reports table with all header information
    const result = await client.query(
      `INSERT INTO trial_balance_reports (
        report_name, report_time, date_macro, report_basis, start_period, end_period, 
        summarize_columns_by, currency, no_report_data, total_debit, total_credit, 
        header_options, columns_info, full_header
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      ) RETURNING id`,
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
        totalDebit,
        totalCredit,
        JSON.stringify(options),
        JSON.stringify(columns),
        JSON.stringify(header)
      ]
    );

    const reportId = result.rows[0].id;

    // Insert all account rows including summary - COMPREHENSIVE KEY COVERAGE
    for (const row of reportData.Rows.Row) {
      // Determine row type and extract data
      const rowType = row.type || (row.group ? 'summary' : 'data');
      const rowGroup = row.group || null;
      
      // Extract account information - covering ALL possible keys
      let accountId = null;
      let accountName = null;
      let debitAmount = 0;
      let creditAmount = 0;
      
      // Process ColData structure completely
      if (row.ColData) {
        // Column 0: Account information
        accountId = row.ColData[0]?.id || null;
        accountName = row.ColData[0]?.value || null;
        
        // Column 1: Debit amount (handle empty strings and various formats)
        const debitValue = row.ColData[1]?.value;
        debitAmount = (debitValue && debitValue !== "") ? parseFloat(debitValue) : 0;
        
        // Column 2: Credit amount (handle empty strings and various formats)  
        const creditValue = row.ColData[2]?.value;
        creditAmount = (creditValue && creditValue !== "") ? parseFloat(creditValue) : 0;
        
      } else if (row.Summary?.ColData) {
        // Process Summary data structure
        accountName = row.Summary.ColData[0]?.value || null;
        const summaryDebitValue = row.Summary.ColData[1]?.value;
        const summaryCreditValue = row.Summary.ColData[2]?.value;
        debitAmount = (summaryDebitValue && summaryDebitValue !== "") ? parseFloat(summaryDebitValue) : 0;
        creditAmount = (summaryCreditValue && summaryCreditValue !== "") ? parseFloat(summaryCreditValue) : 0;
      }

      // Enhanced account classification and analysis
      let accountType = 'Other';
      let accountCategory = 'Other';
      let accountSubcategory = null;
      let isHeaderAccount = false;
      let isSubAccount = false;
      let parentAccount = null;
      let balanceType = 'Normal';
      let normalBalanceSide = 'Unknown';

      if (accountName) {
        const name = accountName.toLowerCase();
        
        // Check if it's a sub-account (contains colon)
        if (accountName.includes(':')) {
          isSubAccount = true;
          const parts = accountName.split(':');
          parentAccount = parts[0];
          accountSubcategory = parts.slice(1).join(':');
        }

        // Detailed account type classification
        if (name.includes('checking') || name.includes('savings') || name.includes('cash') || name.includes('petty cash')) {
          accountType = 'Asset';
          accountCategory = 'Current Asset';
          accountSubcategory = accountSubcategory || 'Cash and Cash Equivalents';
          normalBalanceSide = 'Debit';
        } else if (name.includes('undeposited')) {
          accountType = 'Asset';
          accountCategory = 'Current Asset';
          accountSubcategory = accountSubcategory || 'Cash and Cash Equivalents';
          normalBalanceSide = 'Debit';
        } else if (name.includes('receivable')) {
          accountType = 'Asset';
          accountCategory = 'Current Asset';
          accountSubcategory = accountSubcategory || 'Accounts Receivable';
          normalBalanceSide = 'Debit';
        } else if (name.includes('inventory')) {
          accountType = 'Asset';
          accountCategory = 'Current Asset';
          accountSubcategory = accountSubcategory || 'Inventory';
          normalBalanceSide = 'Debit';
        } else if (name.includes('truck') || name.includes('equipment') || name.includes('building') || name.includes('original cost')) {
          accountType = 'Asset';
          accountCategory = 'Fixed Asset';
          accountSubcategory = accountSubcategory || 'Property, Plant & Equipment';
          normalBalanceSide = 'Debit';
        } else if (name.includes('payable')) {
          accountType = 'Liability';
          accountCategory = name.includes('notes') || name.includes('loan') ? 'Long-term Liability' : 'Current Liability';
          accountSubcategory = accountSubcategory || 'Accounts Payable';
          normalBalanceSide = 'Credit';
        } else if (name.includes('loan') || name.includes('notes') || name.includes('mastercard') || name.includes('credit card')) {
          accountType = 'Liability';
          accountCategory = name.includes('notes') || name.includes('loan') ? 'Long-term Liability' : 'Current Liability';
          accountSubcategory = accountSubcategory || (name.includes('loan') || name.includes('notes') ? 'Long-term Debt' : 'Credit Cards');
          normalBalanceSide = 'Credit';
        } else if (name.includes('equity') || name.includes('retained earnings') || name.includes('opening balance')) {
          accountType = 'Equity';
          accountCategory = 'Owner\'s Equity';
          accountSubcategory = accountSubcategory || (name.includes('retained') ? 'Retained Earnings' : 'Capital');
          normalBalanceSide = 'Credit';
        } else if (name.includes('income') || name.includes('revenue') || name.includes('sales') || name.includes('services') || name.includes('landscaping')) {
          accountType = 'Revenue';
          accountCategory = 'Operating Revenue';
          accountSubcategory = accountSubcategory || 'Service Revenue';
          normalBalanceSide = 'Credit';
        } else if (name.includes('cost of goods') || name.includes('cogs')) {
          accountType = 'Expense';
          accountCategory = 'Cost of Goods Sold';
          accountSubcategory = accountSubcategory || 'Direct Costs';
          normalBalanceSide = 'Debit';
        } else if (name.includes('discount')) {
          accountType = 'Revenue';
          accountCategory = 'Sales Adjustments';
          accountSubcategory = accountSubcategory || 'Discounts and Allowances';
          normalBalanceSide = 'Debit'; // Contra-revenue account
        } else if (name.includes('expense') || name.includes('advertising') || name.includes('utilities') || name.includes('rent') || 
                   name.includes('legal') || name.includes('maintenance') || name.includes('insurance') || name.includes('automobile') ||
                   name.includes('equipment rental') || name.includes('meals') || name.includes('office') || name.includes('miscellaneous')) {
          accountType = 'Expense';
          accountCategory = 'Operating Expense';
          
          // Detailed expense subcategorization
          if (name.includes('advertising')) accountSubcategory = accountSubcategory || 'Marketing & Advertising';
          else if (name.includes('automobile') || name.includes('fuel')) accountSubcategory = accountSubcategory || 'Vehicle Expenses';
          else if (name.includes('utilities')) accountSubcategory = accountSubcategory || 'Utilities';
          else if (name.includes('rent') || name.includes('lease')) accountSubcategory = accountSubcategory || 'Rent & Lease';
          else if (name.includes('legal') || name.includes('accounting') || name.includes('lawyer') || name.includes('bookkeeper')) accountSubcategory = accountSubcategory || 'Professional Services';
          else if (name.includes('maintenance') || name.includes('repair')) accountSubcategory = accountSubcategory || 'Repairs & Maintenance';
          else if (name.includes('insurance')) accountSubcategory = accountSubcategory || 'Insurance';
          else if (name.includes('meals') || name.includes('entertainment')) accountSubcategory = accountSubcategory || 'Meals & Entertainment';
          else if (name.includes('office')) accountSubcategory = accountSubcategory || 'Office Expenses';
          else if (name.includes('job')) accountSubcategory = accountSubcategory || 'Job Costs';
          else accountSubcategory = accountSubcategory || 'General Expenses';
          
          normalBalanceSide = 'Debit';
        }

        // Determine balance type based on amounts
        if (debitAmount > 0 && creditAmount === 0) {
          balanceType = 'Debit Balance';
        } else if (creditAmount > 0 && debitAmount === 0) {
          balanceType = 'Credit Balance';
        } else if (debitAmount === 0 && creditAmount === 0) {
          balanceType = 'Zero Balance';
        } else {
          balanceType = 'Mixed Balance';
        }
      }

      await client.query(
        `INSERT INTO trial_balance_accounts (
          report_id, account_id, account_name, debit_amount, credit_amount, 
          account_type, account_category, account_subcategory, account_group, row_type,
          is_header_account, is_sub_account, parent_account, balance_type, normal_balance_side,
          col_data, summary_data, full_row_data
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        )`,
        [
          reportId,
          accountId,
          accountName,
          debitAmount,
          creditAmount,
          accountType,
          accountCategory,
          accountSubcategory,
          rowGroup,
          rowType,
          isHeaderAccount,
          isSubAccount,
          parentAccount,
          balanceType,
          normalBalanceSide,
          JSON.stringify(row.ColData || null),
          JSON.stringify(row.Summary || null),
          JSON.stringify(row)
        ]
      );
    }

    await client.query("COMMIT");
    
    // Calculate additional statistics
    const stats = await client.query(
      `SELECT 
        COUNT(*) as total_accounts,
        COUNT(*) FILTER (WHERE account_type = 'Asset') as asset_accounts,
        COUNT(*) FILTER (WHERE account_type = 'Liability') as liability_accounts,
        COUNT(*) FILTER (WHERE account_type = 'Equity') as equity_accounts,
        COUNT(*) FILTER (WHERE account_type = 'Revenue') as revenue_accounts,
        COUNT(*) FILTER (WHERE account_type = 'Expense') as expense_accounts,
        COUNT(*) FILTER (WHERE is_sub_account = true) as sub_accounts,
        COUNT(*) FILTER (WHERE balance_type = 'Zero Balance') as zero_balance_accounts,
        SUM(debit_amount) as total_debits,
        SUM(credit_amount) as total_credits
       FROM trial_balance_accounts 
       WHERE report_id = $1 AND row_type != 'summary'`,
      [reportId]
    );

    const accountStats = stats.rows[0];

    res.status(200).send({
      message: "Trial Balance Report saved successfully",
      reportId: reportId,
      totalDebit: totalDebit,
      totalCredit: totalCredit,
      balanceCheck: totalDebit === totalCredit ? "BALANCED" : "UNBALANCED",
      variance: Math.abs(totalDebit - totalCredit),
      reportBasis: header.ReportBasis,
      startPeriod: header.StartPeriod,
      endPeriod: header.EndPeriod,
      accountBreakdown: {
        totalAccounts: parseInt(accountStats.total_accounts),
        assetAccounts: parseInt(accountStats.asset_accounts),
        liabilityAccounts: parseInt(accountStats.liability_accounts),
        equityAccounts: parseInt(accountStats.equity_accounts),
        revenueAccounts: parseInt(accountStats.revenue_accounts),
        expenseAccounts: parseInt(accountStats.expense_accounts),
        subAccounts: parseInt(accountStats.sub_accounts),
        zeroBalanceAccounts: parseInt(accountStats.zero_balance_accounts)
      },
      verification: {
        calculatedTotalDebits: parseFloat(accountStats.total_debits),
        calculatedTotalCredits: parseFloat(accountStats.total_credits),
        summaryTotalDebits: totalDebit,
        summaryTotalCredits: totalCredit,
        calculationMatch: {
          debits: parseFloat(accountStats.total_debits) === totalDebit,
          credits: parseFloat(accountStats.total_credits) === totalCredit
        }
      },
      columnsCount: columns.Column?.length || 0,
      dataMappingComplete: true
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error saving trial balance report:", err);
    res.status(500).send({ 
      error: "Error saving trial balance report", 
      details: err.message 
    });
  } finally {
    client.release();
  }
});

app.listen(5000, () => {
  console.log("Trial Balance service running on port 5000");
});
