// Ladataan tarvittavat kirjastot
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Sallitaan pyynnöt vain sinun verkkosivultasi
app.use(cors({ origin: 'https://pisara25.fi' }));

// Muuta aiemmin lisäämämme testireitti tähän muotoon:
app.get('/', (req, res) => {
  res.send('Pakotettu päivitys toimii! Versio 2.'); // Uusi, selkeä teksti
});

// Varmista, että vanha reittisi on edelleen tämän alapuolella
app.get('/api/data', async (req, res) => {
  // ...
});

// Määritellään reitti, josta dataa haetaan (esim. /api/data)
app.get('/api/data', async (req, res) => {
  try {

    // Haetaan salaisuudet turvallisesti ympäristömuuttujista
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    const API_KEY = process.env.GOOGLE_API_KEY;

    if (!SPREADSHEET_ID || !API_KEY) {
      return res.status(500).json({ error: "Server configuration missing." });
    }

    // Yhteys Google Sheets API:in
    const sheets = google.sheets({ version: 'v4', auth: API_KEY });

    // Datan haku (määritä tähän solualueet, joista dataa haetaan)
    // HUOM: VAIHDA NÄMÄ SOLUALUEET OMIIN OIKEISIIN ARVOIHISI!
    const responses = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [
        'Yksityiset!M1:R3', // Kaavion data
        'Yksityiset!S1:T4'  // Laskurien data
      ]
    });

    const [chartData, counterData] = responses.data.valueRanges;

    // Muotoillaan kaavion data
    const chartValues = chartData.values || [];
    const formattedChart = {
      labels: chartValues.length > 0 ? chartValues[0] : [],
      dataset1: chartValues.length > 1 ? chartValues[1].map(v => parseFloat(v.replace(',', '.')) || 0) : [],
      dataset2: chartValues.length > 2 ? chartValues[2].map(v => parseFloat(v.replace(',', '.')) || 0) : []
    };

    // Muotoillaan laskurien data
    const counterValues = counterData.values ? counterData.values.flat() : [];
    const formattedCounters = {
        yksityisetKpl: parseFloat(counterValues[0]?.replace(',', '.')) || 0,
        yksityisetEuro: parseFloat(counterValues[1]?.replace(',', '.')) || 0,
        yrityksetKpl: parseFloat(counterValues[2]?.replace(',', '.')) || 0,
        yrityksetEuro: parseFloat(counterValues[3]?.replace(',', '.')) || 0
    };

    // Lähetetään siistitty data vastauksena
    res.json({
      chart: formattedChart,
      counters: formattedCounters
    });

  } catch (error) {
    console.error('Error fetching data:', error.message);
    res.status(500).json({ error: 'Failed to fetch data from Google Sheets' });
  }
});

// Käynnistetään palvelin
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});