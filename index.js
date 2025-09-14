// LOPULLINEN JA VANKENNETTU BACKEND-KOODI
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = ['https://pisara25.fi', 'https://neulonbyajastamo.fi'];
app.use(cors({ origin: allowedOrigins }));

// Apufunktio, joka varmistaa, että data on numero-array
const parseNumberArray = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(v => parseFloat(String(v).replace(',', '.')) || 0);
};

// Reitti pääsivun laskureille ja yksityisten kaaviolle
app.get('/api/data', async (req, res) => {
 try {
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    const API_KEY = process.env.GOOGLE_API_KEY;
    const sheets = google.sheets({ version: 'v4', auth: API_KEY });

    const responses = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [
          'Yksityiset!M1:Q3', // 0: Kaaviodata
          'Yksityiset!R4',    // 1: Yksityiset kpl
          'Yksityiset!T2',    // 2: Yksityiset €
          'Yrityksille!X2',   // 3: Yritykset kpl
          'Yrityksille!W2',   // 4: Yritykset €
          'Yksityiset!Z2'     // 5: Keräystavoite
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

// Reitti yritysten kaaviolle
app.get('/api/yrityskaavio', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Yrityksille!R1:V3',
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

// --- MUUTETTU OSA ALKAA ---
// Reitti yrityslistalle (hakee nyt myös terveiset)
app.get('/api/yrityslista', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            // Hakee sarakkeet N (nimi), O (tyhjä) ja P (tervehdys)
            range: 'Yrityksille!N:P', 
        });
        
        const values = (response.data.values || []).slice(1); // Ohitetaan otsikkorivi
        const yritykset = values.map(row => ({
            nimi: row[0] || '',
            tervehdys: row[2] || '' // Sarakkeesta P
        })).filter(yritys => yritys.nimi); // Suodatetaan tyhjät nimet pois

        res.json(yritykset);

    } catch (error) {
        console.error('Virhe /api/yrityslista reitissä:', error.message);
        res.status(500).json({ error: 'Yrityslistan haku epäonnistui' });
    }
});
// --- MUUTETTU OSA PÄÄTTYY ---


// Reitti hyväksytyille terveisille
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
