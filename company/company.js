const express = require("express");
const bodyParser = require("body-parser");
const pool = require("../db");

const app = express();
app.use(bodyParser.json());

app.post("/save-company", async (req, res) => {
  const responseData = req.body;
  const companies = responseData?.Company || [];

  const client = await pool.connect();
  try {
    for (let company of companies) {
      await client.query(
        `INSERT INTO companies (
          id, company_name, legal_name,
          company_addr_id, company_addr_line1, company_addr_city, company_addr_state, company_addr_postal_code, company_addr_lat, company_addr_long,
          cust_comm_addr_id, cust_comm_addr_line1, cust_comm_addr_city, cust_comm_addr_state, cust_comm_addr_postal_code, cust_comm_addr_lat, cust_comm_addr_long,
          legal_addr_id, legal_addr_line1, legal_addr_city, legal_addr_state, legal_addr_postal_code, legal_addr_lat, legal_addr_long,
          primary_phone, email, website,
          company_start_date, country, supported_languages, domain, sparse, sync_token, create_time, last_updated_time
        )
        VALUES (
          $1,$2,$3,
          $4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,
          $18,$19,$20,$21,$22,$23,$24,
          $25,$26,$27,
          $28,$29,$30,$31,$32,$33,$34,$35
        )
        ON CONFLICT (id) DO UPDATE
        SET company_name = EXCLUDED.company_name,
            legal_name = EXCLUDED.legal_name,
            company_addr_id = EXCLUDED.company_addr_id,
            company_addr_line1 = EXCLUDED.company_addr_line1,
            company_addr_city = EXCLUDED.company_addr_city,
            company_addr_state = EXCLUDED.company_addr_state,
            company_addr_postal_code = EXCLUDED.company_addr_postal_code,
            company_addr_lat = EXCLUDED.company_addr_lat,
            company_addr_long = EXCLUDED.company_addr_long,
            cust_comm_addr_id = EXCLUDED.cust_comm_addr_id,
            cust_comm_addr_line1 = EXCLUDED.cust_comm_addr_line1,
            cust_comm_addr_city = EXCLUDED.cust_comm_addr_city,
            cust_comm_addr_state = EXCLUDED.cust_comm_addr_state,
            cust_comm_addr_postal_code = EXCLUDED.cust_comm_addr_postal_code,
            cust_comm_addr_lat = EXCLUDED.cust_comm_addr_lat,
            cust_comm_addr_long = EXCLUDED.cust_comm_addr_long,
            legal_addr_id = EXCLUDED.legal_addr_id,
            legal_addr_line1 = EXCLUDED.legal_addr_line1,
            legal_addr_city = EXCLUDED.legal_addr_city,
            legal_addr_state = EXCLUDED.legal_addr_state,
            legal_addr_postal_code = EXCLUDED.legal_addr_postal_code,
            legal_addr_lat = EXCLUDED.legal_addr_lat,
            legal_addr_long = EXCLUDED.legal_addr_long,
            primary_phone = EXCLUDED.primary_phone,
            email = EXCLUDED.email,
            website = EXCLUDED.website,
            company_start_date = EXCLUDED.company_start_date,
            country = EXCLUDED.country,
            supported_languages = EXCLUDED.supported_languages,
            domain = EXCLUDED.domain,
            sparse = EXCLUDED.sparse,
            sync_token = EXCLUDED.sync_token,
            create_time = EXCLUDED.create_time,
            last_updated_time = EXCLUDED.last_updated_time`,
        [
          company.Id || null,
          company.CompanyName || null,
          company.LegalName || null,

          company.CompanyAddr?.Id || null,
          company.CompanyAddr?.Line1 || null,
          company.CompanyAddr?.City || null,
          company.CompanyAddr?.CountrySubDivisionCode || null,
          company.CompanyAddr?.PostalCode || null,
          company.CompanyAddr?.Lat || null,
          company.CompanyAddr?.Long || null,

          company.CustomerCommunicationAddr?.Id || null,
          company.CustomerCommunicationAddr?.Line1 || null,
          company.CustomerCommunicationAddr?.City || null,
          company.CustomerCommunicationAddr?.CountrySubDivisionCode || null,
          company.CustomerCommunicationAddr?.PostalCode || null,
          company.CustomerCommunicationAddr?.Lat || null,
          company.CustomerCommunicationAddr?.Long || null,

          company.LegalAddr?.Id || null,
          company.LegalAddr?.Line1 || null,
          company.LegalAddr?.City || null,
          company.LegalAddr?.CountrySubDivisionCode || null,
          company.LegalAddr?.PostalCode || null,
          company.LegalAddr?.Lat || null,
          company.LegalAddr?.Long || null,

          company.PrimaryPhone?.FreeFormNumber || null,
          company.Email?.Address || null,
          company.WebSite?.URI || null,

          company.CompanyStartDate || null,
          company.Country || null,
          company.SupportedLanguages || null,
          company.domain || null,
          company.sparse ?? null,
          company.SyncToken || null,
          company.MetaData?.CreateTime ? new Date(company.MetaData.CreateTime) : null,
          company.MetaData?.LastUpdatedTime ? new Date(company.MetaData.LastUpdatedTime) : null
        ]
      );
    }

    res.status(200).send({ message: "Companies saved successfully" });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).send({ error: err.message });
  } finally {
    client.release();
  }
});

app.listen(5000, () => console.log("Service running on port 5000"));
