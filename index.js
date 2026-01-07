const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();

// --- CORS ASETUKSET ---
const allowedOrigins = [
  'https://pisara25.fi',
  'https://www.pisara25.fi',
  'https://neulonbyajastamo.fi',
  'https://www.neulonbyajastamo.fi'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(new Error('CORS ei sallittu'));
    }
  }
}));

// Tarjoillaan chatbot-v3.js staattisena tiedostona
app.get('/chatbot-v3.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'chatbot-v3.js'));
});

// --- TILAUSHAKU ---
app.get('/api/chatbot/tilaus', async (req, res) => {
    let { numero, email } = req.query;
    const shop = process.env.SHOP_URL || "neulon-by-ajastamo.myshopify.com";
    const token = process.env.SHOPIFY_API_SECRET; 

    try {
        const searchName = (numero || "").trim();
        const customerEmail = (email || "").trim().toLowerCase();

        const url = `https://${shop}/admin/api/2024-01/orders.json?name=${encodeURIComponent(searchName)}&status=any`;
        const response = await axios.get(url, {
            headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
        });

        const orders = response.data.orders || [];
        if (orders.length > 0) {
            const tilaus = orders[0];
            const shopifyEmail = (tilaus.email || "").trim().toLowerCase();

            if (shopifyEmail === "" || shopifyEmail === customerEmail) {
                let tila = "Käsittelyssä";
                if (tilaus.fulfillment_status === 'fulfilled') tila = "Lähetetty / Valmis";
                if (tilaus.cancelled_at) tila = "Peruttu";
                return res.json({ viesti: `Tilauksesi (${tilaus.name}) tila on: ${tila}.` });
            } else {
                return res.json({ viesti: "Tilaus löytyi, mutta sähköpostiosoite ei täsmää." });
            }
        }
        res.json({ viesti: "Tilausta ei löytynyt." });
    } catch (e) {
        res.status(500).json({ viesti: "Yhteysvirhe Shopify-palveluun." });
    }
});

// --- GOOGLE SHEETS DATA (Pisara25 varten) ---
app.get('/api/data', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });

        const responses = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: SPREADSHEET_ID,
            ranges: ['Yksityiset!M1:Q3', 'Yksityiset!R4', 'Yksityiset!T2', 'Yrityksille!Z2', 'Yrityksille!Y2', 'Yksityiset!Z2']
        });

        const v = responses.data.valueRanges;
        if (!v || v.length < 6) throw new Error("Data puuttuu");

        const parseArr = (arr) => Array.isArray(arr) ? arr.map(val => parseFloat(String(val).replace(',', '.')) || 0) : [];
        const getVal = (i) => parseFloat(String(v[i]?.values?.[0]?.[0] || '0').replace(',', '.')) || 0;

        res.json({
            lastUpdated: new Date(),
            chart: { 
                labels: v[0].values[0], 
                dataset1: parseArr(v[0].values[1]), 
                dataset2: parseArr(v[0].values[2]) 
            },
            counters: { 
                yksityisetKpl: getVal(1), 
                yksityisetEuro: getVal(2), 
                yrityksetKpl: getVal(3), 
                yrityksetEuro: getVal(4), 
                keraysTavoite: getVal(5) 
            }
        });
    } catch (e) {
        console.error("Google Sheets virhe:", e.message);
        res.status(500).json({ viesti: "Datan lataus epäonnistui" });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Palvelin käynnissä portissa ${PORT}`);
});
