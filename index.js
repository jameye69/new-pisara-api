const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
app.use(cors());

// --- ETUSIVUN DATA (Kuntakohtainen kaavio) ---
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
            chart: { labels: v[0].values[0], dataset1: parseArr(v[0].values[1]), dataset2: parseArr(v[0].values[2]) },
            counters: { yksityisetKpl: getVal(1), yksityisetEuro: getVal(2), yrityksetKpl: getVal(3), yrityksetEuro: getVal(4), keraysTavoite: getVal(5) }
        });
    } catch (e) { res.status(500).json({ error: "Virhe" }); }
});

// --- YRITYSSIVUN KAAVIO (Yritysten kuntakohtainen tilanne) ---
app.get('/api/yrityskaavio', async (req, res) => {
    try {
        const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'Yrityksille!M1:Q3', // TÄMÄ ON TÄRKEÄ: Hakee yritysten kuntakohtaiset luvut
        });
        const rows = response.data.values;
        const parseArr = (arr) => Array.isArray(arr) ? arr.map(val => parseFloat(String(val).replace(',', '.')) || 0) : [];

        res.json({
            labels: rows[0],
            ostojenMaara: parseArr(rows[1]),
            suhdeluku: parseArr(rows[2])
        });
    } catch (e) { res.status(500).json({ error: "Virhe" }); }
});

// --- YRITYSTEN HAASTELISTA (Tervehdykset) ---
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
    } catch (e) { res.status(500).json({ error: "Virhe" }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Live` *cite: 2*));
