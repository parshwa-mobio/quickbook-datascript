const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db"); // pg connection

const app = express();
app.use(bodyParser.json());

app.post("/save-time-activities", async (req, res) => {
  const client = await pool.connect();
  try {
    const { QueryResponse } = req.body;
    const timeActivities = QueryResponse?.TimeActivity || [];
    console.log("timeActivities", timeActivities);
    await client.query("BEGIN");

    for (const activity of timeActivities) {
      await client.query(
        `INSERT INTO time_activities (
            id, txn_date, employee_id, customer_id, item_id,
            time_charge_id, billable_status, taxable, hourly_rate, cost_rate,
            hours, minutes, seconds, description, domain, sparse, sync_token,
            create_time, last_updated_time
        ) VALUES (
            $1,$2,$3,$4,$5,
            $6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,
            $18,$19
        )
        ON CONFLICT (id) DO UPDATE
        SET txn_date = EXCLUDED.txn_date,
            employee_id = EXCLUDED.employee_id,
            customer_id = EXCLUDED.customer_id,
            item_id = EXCLUDED.item_id,
            time_charge_id = EXCLUDED.time_charge_id,
            billable_status = EXCLUDED.billable_status,
            taxable = EXCLUDED.taxable,
            hourly_rate = EXCLUDED.hourly_rate,
            cost_rate = EXCLUDED.cost_rate,
            hours = EXCLUDED.hours,
            minutes = EXCLUDED.minutes,
            seconds = EXCLUDED.seconds,
            description = EXCLUDED.description,
            domain = EXCLUDED.domain,
            sparse = EXCLUDED.sparse,
            sync_token = EXCLUDED.sync_token,
            create_time = EXCLUDED.create_time,
            last_updated_time = EXCLUDED.last_updated_time`,
        [
          activity.Id,
          activity.TxnDate || null,
          activity.EmployeeRef?.value || null,
          activity.CustomerRef?.value || null,
          activity.ItemRef?.value || null,
          activity.TimeChargeId || null,
          activity.BillableStatus || null,
          activity.Taxable || false,
          activity.HourlyRate || 0,
          activity.CostRate || 0,
          activity.Hours || 0,
          activity.Minutes || 0,
          activity.Seconds || 0,
          activity.Description || null,
          activity.domain || null,
          activity.sparse || false,
          activity.SyncToken || null,
          activity.MetaData?.CreateTime || null,
          activity.MetaData?.LastUpdatedTime || null
        ]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Time activities saved successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving time activities:", error);
    res.status(500).json({ error: "Failed to save time activities" });
  } finally {
    client.release();
  }
});

app.listen(5000, () => {
  console.log("TimeActivities service running on port 5000");
});
