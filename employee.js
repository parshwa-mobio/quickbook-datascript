const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
app.use(bodyParser.json());

app.post("/store-employees", async (req, res) => {
  const responseData = req.body;
  const employees = responseData.Employee || [];
  const db = await pool.connect();

  try {
    for (const emp of employees) {
      await db.query(`
        INSERT INTO employees (
          id, billable_time, hired_date, domain, sparse, sync_token,
          given_name, family_name, display_name, print_on_check_name,
          active, v4id_pseudonym, primary_phone_number,
          metadata_create_time, metadata_last_updated_time
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,
          $11,$12,$13,
          $14,$15
        )
        ON CONFLICT (id) DO UPDATE SET
          billable_time = EXCLUDED.billable_time,
          hired_date = EXCLUDED.hired_date,
          domain = EXCLUDED.domain,
          sparse = EXCLUDED.sparse,
          sync_token = EXCLUDED.sync_token,
          given_name = EXCLUDED.given_name,
          family_name = EXCLUDED.family_name,
          display_name = EXCLUDED.display_name,
          print_on_check_name = EXCLUDED.print_on_check_name,
          active = EXCLUDED.active,
          v4id_pseudonym = EXCLUDED.v4id_pseudonym,
          primary_phone_number = EXCLUDED.primary_phone_number,
          metadata_create_time = EXCLUDED.metadata_create_time,
          metadata_last_updated_time = EXCLUDED.metadata_last_updated_time
      `, [
        emp.Id,
        emp.BillableTime,
        emp.HiredDate || null,
        emp.domain,
        emp.sparse,
        emp.SyncToken,
        emp.GivenName,
        emp.FamilyName,
        emp.DisplayName,
        emp.PrintOnCheckName,
        emp.Active,
        emp.V4IDPseudonym,
        emp.PrimaryPhone?.FreeFormNumber || null,
        emp.MetaData?.CreateTime,
        emp.MetaData?.LastUpdatedTime
      ]);
    }

    res.json({ success: true, message: "Employees stored successfully" });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ error: "Failed to store employees" });
  } finally {
    db.release();
  }
});

app.listen(5000, () => console.log("Service running on port 5000"));
