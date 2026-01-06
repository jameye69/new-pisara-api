const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();

// Tarjoillaan chatbot-v3.js suoraan juuresta
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3001;

// --- CORS ASETUKSET ---
const allowedOrigins = [
  'https://pisara25.fi',
  'https://www.pisara25.fi',
  'https://neulonbyajastamo.fi',
  'https://www.neulonbyajastamo.fi',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS ei sallittu'));
    }
  }
}));

// --- TILAUSHAKU LOKITUKSELLA ---

app.get('/api/chatbot/tilaus', async (req, res) => {
    let { numero, email } = req.query;
    const shop = process.env.SHOP_URL || "neulon-by-ajastamo.myshopify.com";
    const token = process.env.SHOPIFY_API_SECRET; 

    console.log(`--- UUSI HAKU ---`);
    console.log(`Syötteet -> Numero: "${numero}", Email: "${email}"`);

    if (!numero || !email) {
        return res.status(400).json({ viesti: "Tilausnumero ja sähköposti puuttuvat." });
    }

    try {
        const searchName = numero.trim();
        const customerEmail = email.trim().toLowerCase();

        // Tehdään kysely Shopifyyn
        const url = `https://${shop}/admin/api/2024-01/orders.json?name=${encodeURIComponent(searchName)}&status=any`;
        
        console.log(`Kysely Shopifylle: ${url}`);

        const response = await axios.get(url, {
            headers: { 
                'X-Shopify-Access-Token': token,
                'Content-Type': 'application/json'
            }
        });

        const orders = response.data.orders || [];
        console.log(`Shopify vastasi. Tilauksia löytyi: ${orders.length}`);

        if (orders.length > 0) {
            // Etsitään tilaus, jonka sähköposti täsmää
            const tilaus = orders.find(o => o.email && o.email.toLowerCase() === customerEmail);

            if (tilaus) {
                console.log(`Tilaus löytyi! Status: ${tilaus.fulfillment_status}`);
                let tila = "Käsittelyssä";
                if (tilaus.fulfillment_status === 'fulfilled') tila = "Lähetetty";
                if (tilaus.cancelled_at) tila = "Peruttu";
                
                return res.json({ 
                    viesti: `Tilauksesi (${tilaus.name}) tila on: ${tila}.` 
                });
            } else {
                console.log(`Tilausnumero löytyi, mutta sähköposti ei täsmää. (Odotettiin: ${customerEmail})`);
            }
        }
        
        res.json({ viesti: "Tilausta ei löytynyt. Varmista, että tilausnumero (esim. #nba-2460) ja sähköposti ovat täsmälleen oikein." });
        
    } catch (e) {
        console.error("!!! SHOPIFY VIRHE !!!");
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data:", JSON.stringify(e.response.data));
        } else {
            console.error("Viesti:", e.message);
        }
        res.status(500).json({ viesti: "Yhteys kauppaan epäonnistui. Yritä myöhemmin uudelleen." });
    }
});

// --- GOOGLE SHEETS (pidetään ennallaan) ---
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
        const parseArr = (arr) => Array.isArray(arr) ? arr.map(v => parseFloat(String(v).replace(',', '.')) || 0) : [];
        const getVal = (i) => parseFloat(String(v[i]?.values?.[0]?.[0] || '0').replace(',', '.')) || 0;
        res.json({
            lastUpdated: new Date(),
            chart: { labels: v[0].values[0], dataset1: parseArr(v[0].values[1]), dataset2: parseArr(v[0].values[2]) },
            counters: { yksityisetKpl: getVal(1), yksityisetEuro: getVal(2), yrityksetKpl: getVal(3), yrityksetEuro: getVal(4), keraysTavoite: getVal(5) }
        });
    } catch (e) { res.status(500).send("Virhe"); }
});

app.listen(PORT, () => {
    console.log(`Palvelin käynnissä portissa ${PORT}`);
});
