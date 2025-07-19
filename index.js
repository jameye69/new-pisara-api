// Ladataan tarvittavat kirjastot
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = ['https://pisara25.fi', 'https://neulonbyajastamo.fi'];
app.use(cors({ origin: allowedOrigins }));

// --- Reitti kaavioille ja laskureille (ennallaan) ---
app.get('/api/data', async (req, res) => {
  // ... Tämä osa pysyy täysin samana kuin ennen ...
  try {
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    const API_KEY = process.env.GOOGLE_API_KEY;

    if (!SPREADSHEET_ID || !API_KEY) {
      return res.status(500).json({ error: "Palvelimen konfiguraatio on puutteellinen." });
    }

    const sheets = google.sheets({ version: 'v4', auth: API_KEY });

    const responses = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [
        'Yksityiset!M1:Q3', 'Yksityiset!R4', 'Yksityiset!T2', 
        'Yrityksille!X2', 'Yrityksille!W2'
      ]
    });

    const valueRanges = responses.data.valueRanges;
    const getCounterValue = (rangeIndex) => {
        const values = valueRanges[rangeIndex]?.values;
        return values && values.length > 0 ? parseFloat(String(values[0][0]).replace(',', '.')) || 0 : 0;
    };

    res.json({
      chart: {
        labels:   valueRanges[0].values[0],
        dataset1: valueRanges[0].values[1].map(v => parseFloat(String(v).replace(',', '.')) || 0),
        dataset2: valueRanges[0].values[2].map(v => parseFloat(String(v).replace(',', '.')) || 0)
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


// --- UUSI REitti YRITYSLISTALLE (ennallaan) ---
app.get('/api/yrityslista', async (req, res) => {
    // ... Tämä osa pysyy täysin samana kuin ennen ...
});


// --- LISÄTTY: UUSI REitti YRITYSTEN KAAVIOLLE ---
app.get('/api/yrityskaavio', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });

        // TÄRKEÄÄ: Varmista, että tämä solualue on oikein sinun Sheetsissäsi!
        // Oletan, että data on "Yrityksille"-välilehdellä soluissa M1:Q3
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Yrityksille!M1:Q3', 
        });

        const chartValues = response.data.values || [];
        const formattedChart = {
          labels:       chartValues.length > 0 ? chartValues[0] : [],
          ostojenMaara: chartValues.length > 1 ? chartValues[1].map(v => parseFloat(String(v).replace(',', '.')) || 0) : [],
          suhdeluku:    chartValues.length > 2 ? chartValues[2].map(v => parseFloat(String(v).replace(',', '.')) || 0) : []
        };
        
        res.json(formattedChart);

    } catch (error) {
        console.error('Virhe /api/yrityskaavio reitissä:', error.message);
        res.status(500).json({ error: 'Yrityskaavion datan haku epäonnistui' });
    }
});


app.listen(PORT, () => {
  console.log(`Palvelin käynnissä portissa ${PORT}`);
});
