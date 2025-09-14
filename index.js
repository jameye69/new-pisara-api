// LOPULLINEN JA TOIMIVA BACKEND-KOODI (V3)
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = ['https://pisara25.fi', 'https://neulonbyajastamo.fi'];
app.use(cors({ origin: allowedOrigins }));

const parseNumberArray = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(v => parseFloat(String(v).replace(',', '.')) || 0);
};

const fetchAndParseSheetData = async (auth, spreadsheetId, range) => {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const values = response.data.values || [];

    if (values.length < 2) return [];

    const headers = values[0];
    const dataRows = values.slice(1);

    return dataRows.map(row => {
        const rowData = {};
        headers.forEach((header, index) => {
            rowData[header.trim()] = row[index] || '';
        });
        return rowData;
    });
};

app.get('/api/data', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });

        const responses = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: SPREADSHEET_ID,
            ranges: [
                'Yksityiset!M1:Q3', 'Yksityiset!R4', 'Yksityiset!T2',
                'Yrityksille!X2', 'Yrityksille!W2', 'Yksityiset!Z2'
            ]
        });

        const valueRanges = responses.data.valueRanges;
        const getCounterValue = (idx) => parseFloat(String(valueRanges[idx]?.values?.[0]?.[0] || '0').replace(',', '.')) || 0;

        const chartValues = valueRanges[0].values || [];
        res.json({
            lastUpdated: new Date(),
            chart: {
                labels: chartValues[0] || [],
                dataset1: parseNumberArray(chartValues[1]),
                dataset2: parseNumberArray(chartValues[2])
            },
            counters: {
                yksityisetKpl: getCounterValue(1),
                yksityisetEuro: getCounterValue(2),
                yrityksetKpl: getCounterValue(3),
                yrityksetEuro: getCounterValue(4),
                keraysTavoite: getCounterValue(5)
            }
        });
    } catch (error) {
        console.error('Virhe /api/data reitissä:', error.message);
        res.status(500).json({ error: 'Päädatan haku epäonnistui' });
    }
});

app.get('/api/yrityskaavio', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Yrityksille!T1:X3',
        });
        
        const chartValues = response.data.values || [];
        res.json({
            labels: chartValues[0] || [],
            ostojenMaara: parseNumberArray(chartValues[1]),
            suhdeluku: parseNumberArray(chartValues[2])
        });
    } catch (error) {
        console.error('Virhe /api/yrityskaavio reitissä:', error.message);
        res.status(500).json({ error: 'Yrityskaavion datan haku epäonnistui' });
    }
});

// --- LOPULLINEN KORJATTU YRITYSLISTA ---
app.get('/api/yrityslista', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;

        const yrityksetData = await fetchAndParseSheetData(API_KEY, SPREADSHEET_ID, 'Yrityksille!A:Z');
        
        const yritykset = yrityksetData
            // KORJATTU: Luotettavampi suodatus. Näytetään rivi, jos siinä on yrityksen nimi JA julkaisuteksti.
            .filter(row => row['Yritys/yhteisö'] && row['Tietonsa julkistaneet mukana olevat yritykset'])
            .map(row => ({
                nimi: row['Yritys/yhteisö'] || '',
                tervehdys: (String(row['Tervehdys_Hyväksytty']).trim().toLowerCase() === 'k') 
                            ? (row['Terveiset / onnittelut'] || '') 
                            : ''
            }));

        res.json(yritykset);
    } catch (error) {
        console.error('Virhe /api/yrityslista reitissä:', error.message);
        res.status(500).json({ error: 'Yrityslistan haku epäonnistui' });
    }
});

app.get('/api/terveiset', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'JulkaistutTerveiset!A:B', 
        });
        
        const values = response.data.values || [];
        const terveiset = values.map(row => ({
            tervehdys: row[0] || '',
            kunta: row[1] || ''
        }));

        res.json(terveiset);
    } catch (error) {
        console.error('Virhe /api/terveiset reitissä:', error.message);
        res.status(500).json({ error: 'Terveisten haku epäonnistui' });
    }
});

app.listen(PORT, () => {
    console.log(`Palvelin käynnissä portissa ${PORT}`);
});
