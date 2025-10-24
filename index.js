// LOPULLINEN JA TOIMIVA BACKEND-KOODI (V6.1 - Korjattu yrityskaavio)
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

// === TÄMÄ LOHKO ON KORJATTU ===
app.get('/api/yrityskaavio', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });

        // 1. Haetaan vain kaksi ensimmäistä riviä (Labels ja Kpl)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Yrityksille!T1:X2', // Muutettu T1:X3 -> T1:X2
        });
        
        const chartValues = response.data.values || [];
        const labels = chartValues[0] || [];
        const ostojenMaara = parseNumberArray(chartValues[1]);
        
        // 2. Määritellään kuntien väkiluvut (suhdeluvut) manuaalisesti
        // TÄRKEÄÄ: Järjestyksen TÄYTYY vastata Google Sheetsin T1:X1 -solujen järjestystä
        const KUNTIEN_VAKILUVUT = {
            "Inkoo": 5407,
            "Kirkkonummi": 41015,
            "Lohja": 45855,
            "Siuntio": 6175,
            "Vihti": 29018
        };

        // 3. Luodaan suhdeluku-taulukko haettujen labelien perusteella
        const suhdeluvut = labels.map(kuntaNimi => KUNTIEN_VAKILUVUT[kuntaNimi] || 0);

        // 4. Palautetaan data frontendille. Frontend osaa nyt laskea ostojenMaara / suhdeluku
        res.json({
            labels: labels,
            ostojenMaara: ostojenMaara,
            suhdeluku: suhdeluvut // Palautetaan nyt kovakoodatut väkiluvut
        });

    } catch (error) {
        console.error('Virhe /api/yrityskaavio reitissä:', error.message);
        res.status(500).json({ error: 'Yrityskaavion datan haku epäonnistui' });
    }
});
// === KORJAUS PÄÄTTYY ===


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

// --- TÄMÄ OSIO ON NYT PÄIVITETTY TIETOJESI MUKAAN ---
app.get('/api/terveiset', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;

        // Haetaan kaikki data 'Vastaukset'-välilehdeltä
        const kaikkiData = await fetchAndParseSheetData(API_KEY, SPREADSHEET_ID, 'Vastaukset!A:Z');
        
        const terveiset = kaikkiData
            // 1. Suodatetaan rivit, joiden 'Hyväksytty'-sarakkeessa on 'k'
            .filter(row => row['Hyväksytty'] && String(row['Hyväksytty']).trim().toLowerCase() === 'k')
            // 2. Muotoillaan data siistiin muotoon oikeilla sarakenimillä
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
// ----------------------------------------------------

app.listen(PORT, () => {
    console.log(`Palvelin käynnissä portissa ${PORT}`);
});
