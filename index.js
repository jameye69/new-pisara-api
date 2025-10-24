// LOPULLINEN JA TOIMIVA BACKEND-KOODI (V6.2 - Korjattu CORS ja yrityskaavio)
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// === TÄMÄ LOHKO ON KORJATTU ===
// Määritellään sallitut osoitteet
const allowedOrigins = [
  'https://pisara25.fi',
  'https://neulonbyajastamo.fi',
  'http://localhost:3000', // Lisätty localhostia varten (vaihda portti tarvittaessa)
  'http://localhost:8080'  // Lisätty toinen yleinen testausportti
];

app.use(cors({
  origin: function (origin, callback) {
    // Salli pyynnöt, joilla ei ole 'origin'-otsaketta (esim. Postman, mobiilisovellukset)
    if (!origin) return callback(null, true);

    // Tarkista, onko pyynnön 'origin' sallittujen listalla TAI sen 'www.'-alkuisena versiona
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      // Salli suora osuma (esim. https://pisara25.fi)
      if (origin === allowedOrigin) return true;
      
      // Salli www-aliverkkotunnus (esim. https://www.pisara25.fi)
      if (allowedOrigin.startsWith('https://') && 
          origin === 'https://www.' + allowedOrigin.substring(8)) return true;
          
      return false;
    });

    if (isAllowed) {
      // Salli pyyntö
      callback(null, true);
    } else {
      // Estä pyyntö
      callback(new Error('Ei sallittu CORS-käytännön vuoksi'));
    }
  }
}));
// === CORS-KORJAUS PÄÄTTYY ===


const parseNumberArray = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(v => parseFloat(String(v).replace(',', '.')) || 0);
};

// Apufunktio, joka hakee datan ja muuttaa sen objekteiksi otsikkorivin perusteella.
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
                'Yksityiset!M1:Q3',
                'Yksityiset!R4',
                'Yksityiset!T2',
                'Yrityksille!Z2',
                'Yrityksille!Y2',
                'Yksityiset!Z2'
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

// Tämä on se lohko, jonka korjasimme aiemmin tuomaan väkiluvut
app.get('/api/yrityskaavio', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });

        // 1. Haetaan vain kaksi ensimmäistä riviä (Labels ja Kpl)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Yrityksille!T1:X2', // Haetaan vain Kpl-määrät
        });
        
        const chartValues = response.data.values || [];
        const labels = chartValues[0] || [];
        const ostojenMaara = parseNumberArray(chartValues[1]);
        
        // 2. Määritellään kuntien väkiluvut (suhdeluvut) manuaalisesti
        const KUNTIEN_VAKILUVUT = {
            "Inkoo": 5407,
            "Kirkkonummi": 41015,
            "Lohja": 45855,
            "Siuntio": 6175,
            "Vihti": 29018
        };

        // 3. Luodaan suhdeluku-taulukko haettujen labelien perusteella
        const suhdeluvut = labels.map(kuntaNimi => KUNTIEN_VAKILUVUT[kuntaNimi] || 0);

        // 4. Palautetaan data frontendille
        res.json({
            labels: labels,
            ostojenMaara: ostojenMaara,
            suhdeluku: suhdeluvut
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

        const yrityksetData = await fetchAndParseSheetData(API_KEY, SPREADSHEET_ID, 'Yrityksille!A:Z');
        
        const yritykset = yrityksetData
            .filter(row => row['Yritys/yhteisö'] && row['Tietonsa julkistaneet mukana olevat yritykset'])
            .map(row => ({
                nimi: row['Tietonsa julkistaneet mukana olevat yritykset'] || '', 
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

        const kaikkiData = await fetchAndParseSheetData(API_KEY, SPREADSHEET_ID, 'Vastaukset!A:Z');
        
        const terveiset = kaikkiData
            .filter(row => row['Hyväksytty'] && String(row['Hyväksytty']).trim().toLowerCase() === 'k')
            .map(row => ({
                aikaleima: row['Aikaleima'] || '',
                tervehdys: row['Tervehdys'] || '',
                kunta: row['Kunta'] || ''
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

