require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
app.use(cors());

const parseArr = (arr) => Array.isArray(arr) ? arr.map(val => parseFloat(String(val).replace(',', '.')) || 0) : [];

// --- 1. ETUSIVU: YKSITYISTEN DATA (ÄLÄ MUUTA TOIMIVAA) ---
app.get('/api/data', async (req, res) => {
    try {
        const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
        const responses = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: process.env.SPREADSHEET_ID,
            ranges: ['Yksityiset!M1:Q3', 'Yksityiset!R4', 'Yksityiset!T2', 'Yrityksille!Z2', 'Yrityksille!Y2', 'Yksityiset!Z2']
        });
        const v = responses.data.valueRanges;
        const getVal = (i) => parseFloat(String(v[i]?.values?.[0]?.[0] || '0').replace(',', '.')) || 0;
        res.json({
            lastUpdated: new Date(),
            chart: { labels: v[0].values[0], dataset1: parseArr(v[0].values[1]), dataset2: parseArr(v[0].values[2]) },
            counters: { yksityisetKpl: getVal(1), yksityisetEuro: getVal(2), yrityksetKpl: getVal(3), yrityksetEuro: getVal(4), keraysTavoite: getVal(5) }
        });
    } catch (e) { res.status(500).json({ error: "Virhe" }); }
});

// --- 2. YRITYSSIVU: KAAVIO (KORJATTU SARAKKEET H-L) ---
app.get('/api/yrityskaavio', async (req, res) => {
    try {
        const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'Yrityksille!H1:L3', // H=Inkoo, I=Kirkkonummi, J=Lohja, K=Siuntio, L=Vihti
        });
        const rows = response.data.values;
        res.json({
            labels: rows[0], // Inkoo, Kirkkonummi...
            ostojenMaara: parseArr(rows[1]),
            suhdeluku: parseArr(rows[2])
        });
    } catch (e) { res.status(500).json({ error: "Virhe" }); }
});

// --- 3. YRITYSHAASTEET (HAASTAJA -> HAASTETTAVA) ---
app.get('/api/haasteet', async (req, res) => {
    try {
        const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'Yrityksille!A3:F50', // A=Etunimi, D=Yritys
        });
        const rows = response.data.values || [];
        // Muotoillaan: Etunimi haastaa Yrityksen
        const haasteet = rows.map(r => ({ haastaja: r[0], haastettava: r[3] })).filter(h => h.haastaja && h.haastettava);
        res.json(haasteet);
    } catch (e) { res.json([]); }
});

// --- 4. YRITYSTEN TERVEHDYKSET (KORJATTU SARAKKEET M & O) ---
app.get('/api/yrityslista', async (req, res) => {
    try {
        const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'Yrityksille!M3:O100', // M=Yrityksen nimi listaukseen, O=Terveiset
        });
        const rows = response.data.values || [];
        const lista = rows.map(r => ({ nimi: r[0], tervehdys: r[2] })).filter(yr => yr.nimi);
        res.json(lista);
    } catch (e) { res.json([]); }
});

// --- 5. YKSITYISTEN TERVEISET (PIDETÄÄN ENNALLAAN) ---
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
app.listen(PORT, () => console.log(`Kaikki Pisara25 reitit toiminnassa portissa ${PORT}`));
