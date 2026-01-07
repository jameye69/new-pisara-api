const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();

// Sallitaan kaikki alkuperät (origins), jotta vältytään CORS-ongelmilta debugauksen aikana
app.use(cors());

// --- 1. TARJOILLAAN CHATBOT-SKRIPTI ---
// Tämä on nyt täysin erillään API-reiteistä
app.get('/chatbot-v3.js', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'chatbot-v3.js'));
});

// --- 2. API: PÄÄDATA (Pisara25 Kaaviot) ---
app.get('/api/data', async (req, res) => {
    try {
        const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
        const responses = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: process.env.SPREADSHEET_ID,
            ranges: ['Yksityiset!M1:Q3', 'Yksityiset!R4', 'Yksityiset!T2', 'Yrityksille!Z2', 'Yrityksille!Y2', 'Yksityiset!Z2']
        });

        const v = responses.data.valueRanges;
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
        console.error("DATA VIRHE:", e);
        res.status(500).json({ error: "Datan lataus epäonnistui" });
    }
});

// --- 3. API: YRITYSHAASTEET ---
app.get('/api/haasteet', async (req, res) => {
    try {
        const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'Yrityksille!A2:B50',
        });

        const rows = response.data.values || [];
        const haasteet = rows.map(r => ({ nimi: r[0], haaste: r[1] })).filter(h => h.nimi);
        res.json(haasteet);
    } catch (e) {
        console.error("HAASTE VIRHE:", e);
        res.status(500).json({ error: "Haasteiden lataus epäonnistui" });
    }
});

// --- 4. API: TILAUSHAKU (Neulon) ---
app.get('/api/chatbot/tilaus', async (req, res) => {
    try {
        const { numero, email } = req.query;
        const url = `https://${process.env.SHOP_URL}/admin/api/2024-01/orders.json?name=${encodeURIComponent(numero)}&status=any`;
        const response = await axios.get(url, {
            headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_API_SECRET }
        });

        const orders = response.data.orders || [];
        if (orders.length > 0) {
            const t = orders[0];
            const sEmail = (t.email || "").toLowerCase();
            const cEmail = (email || "").toLowerCase();

            if (!sEmail || sEmail === cEmail) {
                let tila = t.fulfillment_status === 'fulfilled' ? "Lähetetty" : "Käsittelyssä";
                return res.json({ viesti: `Tilauksesi tila: ${tila}.` });
            }
        }
        res.json({ viesti: "Tilausta ei löytynyt." });
    } catch (e) {
        res.status(500).json({ viesti: "Yhteysvirhe." });
    }
});

app.listen(process.env.PORT || 3001);
