// LOPULLINEN JA TÄYDELLINEN BACKEND-KOODI
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = ['https://pisara25.fi', 'https://neulonbyajastamo.fi'];
app.use(cors({ origin: allowedOrigins }));

// Reitti pääsivun laskureille ja yksityisten kaaviolle
app.get('/api/data', async (req, res) => {
  try {
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    const API_KEY = process.env.GOOGLE_API_KEY;
    const sheets = google.sheets({ version: 'v4', auth: API_KEY });

    const responses = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [ 'Yksityiset!M1:Q3', 'Yksityiset!R4', 'Yksityiset!T2', 'Yrityksille!X2', 'Yrityksille!W2' ]
    });

    const valueRanges = responses.data.valueRanges;
    const getCounterValue = (idx) => parseFloat(String(valueRanges[idx]?.values?.[0]?.[0] || '0').replace(',', '.')) || 0;

    res.json({
      chart: {
        labels:   valueRanges[0].values?.[0] || [],
        dataset1: (valueRanges[0].values?.[1] || []).map(v => parseFloat(String(v).replace(',', '.')) || 0),
        dataset2: (valueRanges[0].values?.[2] || []).map(v => parseFloat(String(v).replace(',', '.')) || 0)
      },
      counters: {
        yksityisetKpl: getCounterValue(1),
        yksityisetEuro: getCounterValue(2),
        yrityksetKpl: getCounterValue(3),
        yrityksetEuro: getCounterValue(4)
      }
    });
  } catch (error) {
    console.error('Virhe /api/data reitissä:', error.message);
    res.status(500).json({ error: 'Datan haku epäonnistui' });
  }
});

// Reitti yritysten kaaviolle
app.get('/api/yrityskaavio', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Yrityksille!M1:Q3', // Varmista, että tämä on oikea alue
        });

        const chartValues = response.data.values || [];
        res.json({
          labels:       chartValues.length > 0 ? chartValues[0] : [],
          ostojenMaara: chartValues.length > 1 ? chartValues[1].map(v => parseFloat(String(v).replace(',', '.')) || 0) : [],
          suhdeluku:    chartValues.length > 2 ? chartValues[2].map(v => parseFloat(String(v).replace(',', '.')) || 0) : []
        });
    } catch (error) {
        console.error('Virhe /api/yrityskaavio reitissä:', error.message);
        res.status(500).json({ error: 'Yrityskaavion datan haku epäonnistui' });
    }
});

app.listen(PORT, () => {
  console.log(`Palvelin käynnissä portissa ${PORT}`);
});
