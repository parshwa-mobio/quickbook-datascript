const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Save TaxClassification data
app.post("/tax-classifications", async (req, res) => {
    const client=await pool.connect();
  try {
    const { TaxClassification } = req.body.QueryResponse;

    for (const classification of TaxClassification) {
      const {
        Code,
        Name,
        Description,
        Level,
        ParentRef,
        ApplicableTo
      } = classification;

      // Insert into tax_classifications
      const result = await pool.query(
        `INSERT INTO tax_classifications 
          (code, name, description, level, parent_ref_value, parent_ref_name)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE 
           SET name = EXCLUDED.name,
               description = EXCLUDED.description,
               level = EXCLUDED.level,
               parent_ref_value = EXCLUDED.parent_ref_value,
               parent_ref_name = EXCLUDED.parent_ref_name
         RETURNING id`,
        [
          Code,
          Name,
          Description,
          Level,
          ParentRef?.value || null,
          ParentRef?.name || null,
        ]
      );

      const classificationId = result.rows[0].id;

      // Clean old ApplicableTo before inserting new
      await pool.query(
        `DELETE FROM tax_classification_applicable_to WHERE classification_id = $1`,
        [classificationId]
      );

      if (Array.isArray(ApplicableTo)) {
        for (const type of ApplicableTo) {
          await pool.query(
            `INSERT INTO tax_classification_applicable_to (classification_id, applicable_type)
             VALUES ($1, $2)`,
            [classificationId, type]
          );
        }
      }
    }

    res.json({ message: "Tax classifications saved successfully" });
  } catch (error) {
    console.error("Error saving tax classifications:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(5000, () => {
  console.log("Local DB service running on port 5000");
});

