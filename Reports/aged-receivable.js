const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post('/aged-receivables', async (req, res) => {
    try {
        const report = req.body;
        const reportDate = report.Header.Option.find(opt => opt.Name === 'report_date')?.Value;

        if (!reportDate) return res.status(400).json({ message: 'Report date missing' });

        const rows = report.Rows.Row;
        const insertPromises = [];

        const processRow = (row) => {
            // Check if it's a Section with nested Rows
            if (row.Rows && row.Rows.Row) {
                row.Rows.Row.forEach(nestedRow => processRow(nestedRow));
            } else if (row.ColData) {
                const col = row.ColData;
                const customer_name = col[0]?.value || null;
                const current = parseFloat(col[1]?.value) || 0;
                const days_1_30 = parseFloat(col[2]?.value) || 0;
                const days_31_60 = parseFloat(col[3]?.value) || 0;
                const days_61_90 = parseFloat(col[4]?.value) || 0;
                const days_91_over = parseFloat(col[5]?.value) || 0;
                const total = parseFloat(col[6]?.value) || 0;

                insertPromises.push(
                    pool.query(
                        `INSERT INTO aged_receivables
                        (report_date, customer_name, current, days_1_30, days_31_60, days_61_90, days_91_over, total)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                        ON CONFLICT(report_date, customer_name) DO UPDATE SET
                        current=EXCLUDED.current,
                        days_1_30=EXCLUDED.days_1_30,
                        days_31_60=EXCLUDED.days_31_60,
                        days_61_90=EXCLUDED.days_61_90,
                        days_91_over=EXCLUDED.days_91_over,
                        total=EXCLUDED.total`,
                        [reportDate, customer_name, current, days_1_30, days_31_60, days_61_90, days_91_over, total]
                    )
                );
            }
        };

        rows.forEach(row => processRow(row));

        await Promise.all(insertPromises);

        res.json({ message: 'Aged Receivables saved successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});



app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});
