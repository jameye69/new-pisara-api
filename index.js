// LOPULLINEN JA VANKENNETTU BACKEND-KOODI
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
        labels:   chartValues[0] || [],
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

// --- KORJATTU OSA ---
app.get('/api/yrityskaavio', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            // Päivitetty hakemaan sarakkeista S-W
            range: 'Yrityksille!S1:W3',
        });
        
        const chartValues = response.data.values || [];
        res.json({
          labels:       chartValues[0] || [],
          ostojenMaara: parseNumberArray(chartValues[1]),
          suhdeluku:    parseNumberArray(chartValues[2])
        });
    } catch (error) {
        console.error('Virhe /api/yrityskaavio reitissä:', error.message);
        res.status(500).json({ error: 'Yrityskaavion datan haku epäonnistui' });
    }
});

app.get('/api/yrityslista', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            // Päivitetty hakemaan sarakkeista N-R
            range: 'Yrityksille!N:R', 
        });
        
        const values = (response.data.values || []).slice(1);
        
        const yritykset = values
            .filter(row => row[1] && row[1].trim() === 'Haluan, että tietoni lisätään osallistujalistalle')
            .map(row => ({
                nimi: row[0] || '',
                tervehdys: (row[3] && row[3].trim().toLowerCase() === 'k') ? (row[2] || '') : ''
            }));

        res.json(yritykset);
    } catch (error) {
        console.error('Virhe /api/yrityslista reitissä:', error.message);
        res.status(500).json({ error: 'Yrityslistan haku epäonnistui' });
    }
});
// --- KORJAUS PÄÄTTYY ---

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
