const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');

const app = express();

// Sallitaan Pisara25-sivuston liikenne
const allowedOrigins = [
  'https://pisara25.fi',
  'https://www.pisara25.fi'
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

// PISARA25: Päädata (Kaaviot ja laskurit)
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
        console.error("Pisara25 Data-virhe:", e.message);
        res.status(500).json({ error: "Datan lataus epäonnistui" });
    }
});

// PISARA25: Yrityshaasteet
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
        console.error("Pisara25 Haaste-virhe:", e.message);
        res.status(500).json({ error: "Haasteiden haku epäonnistui" });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Pisara25 API käynnissä portissa ${PORT}`);
});
