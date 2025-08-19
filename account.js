const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
app.use(bodyParser.json());

app.post("/save-accounts", async (req, res) => {
  try {
    const accounts = req.body;
    const client = await pool.connect();
    for (const acc of accounts) {
      await client.query(
        `INSERT INTO accounts 
        (qb_id, name, sub_account, fully_qualified_name, active, classification, account_type, account_sub_type,
         current_balance, current_balance_with_subaccounts, currency_value, currency_name, domain, sparse,
         sync_token, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          acc.Id,
          acc.Name,
          acc.SubAccount,
          acc.FullyQualifiedName,
          acc.Active,
          acc.Classification,
          acc.AccountType,
          acc.AccountSubType,
          acc.CurrentBalance,
          acc.CurrentBalanceWithSubAccounts,
          acc.CurrencyRef?.value,
          acc.CurrencyRef?.name,
          acc.domain,
          acc.sparse,
          acc.SyncToken,
          acc.MetaData?.CreateTime,
          acc.MetaData?.LastUpdatedTime
        ]
      );
    }

    res.status(201).json({ message: "Accounts saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
