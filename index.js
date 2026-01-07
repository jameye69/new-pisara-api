const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
app.use(cors());

// Apufunktio luvun muuttamiseen (käsittelee pilkut ja pisteet)
const parseArr = (arr) => Array.isArray(arr) ? arr.map(val => parseFloat(String(val).replace(',', '.')) || 0) : [];

// --- 1. ETUSIVU: DATA & LASKURIT ---
app.get('/api/data', async (req, res) => {
    try {
        const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
        const responses = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: process.env.SPREADSHEET_ID,
            ranges: [
                'Yksityiset!M1:Q3', // Kaavion kuntakohtaiset luvut
                'Yksityiset!R4',    // Yksityiset kpl
                'Yksityiset!T2',    // Yksityiset euro
                'Yrityksille!Z2',   // Yritykset kpl
                'Yrityksille!Y2',   // Yritykset euro
                'Yksityiset!Z2'     // Keräystavoite
            ]
        });
        const v = responses.data.valueRanges;
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
    } catch (e) { res.status(500).json({ error: "Virhe datan haussa" }); }
});

// --- 2. YRITYSSIVU: YRITYSKAAVIO ---
app.get('/api/yrityskaavio', async (req, res) => {
    try {
        const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'Yrityksille!M1:Q3', // Yritysten kuntakohtaiset tiedot
        });
        const rows = response.data.values;
        if (!rows) return res.status(404).json({ error: "Dataa ei löytynyt" });

        res.json({
            labels: rows[0],
            ostojenMaara: parseArr(rows[1]),
            suhdeluku: parseArr(rows[2])
        });
    } catch (e) { res.status(500).json({ error: "Yrityskaavion virhe" }); }
});

// --- 3. HAASTEET ---
app.get('/api/haasteet', async (req, res) => {
    try {
        const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'Yrityksille!A2:B50', 
        });
        const rows = response.data.values || [];
        const haasteet = rows.map(r => ({ haastaja: r[0], haastettava: r[1] })).filter(h => h.haastaja && h.haastettava);
        res.json(haasteet);
    } catch (e) { res.json([]); }
});

// --- 4. YRITYSLISTA ---
app.get('/api/yrityslista', async (req, res) => {
    try {
        const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'Yrityksille!A2:C100', 
        });
        const rows = response.data.values || [];
        const lista = rows.map(r => ({ nimi: r[0], tervehdys: r[2] })).filter(yr => yr.nimi);
        res.json(lista);
    } catch (e) { res.json([]); }
});

// --- 5. TERVEISET ---
app.get('/api/terveiset', async (req, res) => {
    try {
        const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'Yksityiset!A2:D100', 
        });
        const rows = response.data.values || [];
        const lista = rows.map(r => ({ aikaleima: r[0], kunta: r[1], tervehdys: r[3] })).filter(t => t.tervehdys);
        res.json(lista);
    } catch (e) { res.json([]); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
