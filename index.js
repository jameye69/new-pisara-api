const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = ['https://pisara25.fi', 'https://neulonbyajastamo.fi'];
app.use(cors({ origin: allowedOrigins }));

app.get('/api/data', async (req, res) => {
  try {
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    const API_KEY = process.env.GOOGLE_API_KEY;

    if (!SPREADSHEET_ID || !API_KEY) {
      return res.status(500).json({ error: "Palvelimen konfiguraatio on puutteellinen." });
    }

    const sheets = google.sheets({ version: 'v4', auth: API_KEY });

    // KORJATUT SOLUALUEET OIKEILLA VÄLILEHDILLÄ
    const responses = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [
        'Yksityiset!M1:Q3',  // Kaavion data
        'Yksityiset!R4',     // Laskuri: Yksityiset kpl
        'Yksityiset!T2',     // Laskuri: Yksityiset €
        'Yrityksille!X2',    // KORJATTU: Laskuri: Yritykset kpl
        'Yrityksille!W2'     // KORJATTU: Laskuri: Yritykset €
      ]
    });

    const valueRanges = responses.data.valueRanges;

    // Kaavion datan käsittely
    const chartValues = valueRanges[0].values || [];
    const formattedChart = {
      labels:   chartValues.length > 0 ? chartValues[0] : [],
      dataset1: chartValues.length > 1 ? chartValues[1].map(v => parseFloat(String(v).replace(',', '.')) || 0) : [],
      dataset2: chartValues.length > 2 ? chartValues[2].map(v => parseFloat(String(v).replace(',', '.')) || 0) : []
    };
    
    // Laskurien datan käsittely
    const getCounterValue = (rangeIndex) => {
        const values = valueRanges[rangeIndex]?.values;
        return values && values.length > 0 ? parseFloat(String(values[0][0]).replace(',', '.')) || 0 : 0;
    };

    const formattedCounters = {
        yksityisetKpl: getCounterValue(1),
        yksityisetEuro: getCounterValue(2),
        yrityksetKpl: getCounterValue(3),
        yrityksetEuro: getCounterValue(4)
    };

    // Lähetetään siistitty data vastauksena
    res.json({
      chart: formattedChart,
      counters: formattedCounters
    });

  } catch (error) {
    console.error('Virhe datan haussa:', error.message);
    res.status(500).json({ error: 'Datan haku Google Sheetsistä epäonnistui' });
  }
});

app.listen(PORT, () => {
  console.log(`Palvelin käynnissä portissa ${PORT}`);
});
