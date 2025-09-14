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

// --- YLEISDATAN HAKU (EI MUUTOKSIA) ---
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


// --- YRITYSKAAVION HAKU (KORJATTU SELITYKSILLÄ) ---
app.get('/api/yrityskaavio', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            // TÄRKEÄÄ: Tämä kiinteä alue on todennäköisesti nyt väärä.
            // Sinun täytyy tarkistaa Sheetsistä, missä soluissa kaavion data NYT on,
            // ja päivittää tämä alue vastaamaan sitä. Esim. 'Yrityksille!U1:Y3'
            range: 'Yrityksille!S1:W3',
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

// --- YRITYSLISTAN HAKU (TÄYSIN UUDISTETTU JA VANKENNETTU) ---
app.get('/api/yrityslista', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });

        // 1. Hae KAIKKI data välilehdeltä. Käytetään laajaa aluetta (A-Z),
        // jotta uudet sarakkeet tulevat varmasti mukaan.
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Yrityksille!A:Z', // Hakee kaikki sarakkeet A:sta Z:aan
        });
        
        const values = response.data.values || [];

        // Tarkistetaan onko sheetissä mitään dataa.
        if (values.length < 2) {
            return res.json([]); // Palautetaan tyhjä lista jos ei ole otsikoita tai dataa.
        }

        // 2. Erottele otsikot (ensimmäinen rivi) ja datarivit (loput).
        const headers = values[0];
        const dataRows = values.slice(1);

        // 3. Muunna jokainen datarivi objektiksi, jossa avaimina ovat sarakkeiden otsikot.
        const yritykset = dataRows
            .map(row => {
                const rowObject = {};
                headers.forEach((header, index) => {
                    rowObject[header] = row[index];
                });
                return rowObject;
            })
            // 4. Suodata ja muotoile data käyttämällä otsikkonimiä, ei indeksinumeroita.
            .filter(riviObjekti => {
                // TARKISTA TÄMÄ: Varmista, että sarakkeen otsikko on täsmälleen 'Julkaisulupa'.
                const julkaisulupa = riviObjekti['Julkaisulupa'];
                return julkaisulupa && julkaisulupa.trim() === 'Haluan, että tietoni lisätään osallistujalistalle';
            })
            .map(riviObjekti => {
                // TARKISTA NÄMÄ: Varmista, että otsikot ovat 'Yrityksen nimi', 'Terveiset' ja 'Hyväksytty'.
                const onkoHyvaksytty = riviObjekti['Hyväksytty'] && riviObjekti['Hyväksytty'].trim().toLowerCase() === 'kyllä';
                
                return {
                    nimi: riviObjekti['Yrityksen nimi'] || '',
                    tervehdys: onkoHyvaksytty ? (riviObjekti['Terveiset'] || '') : ''
                };
            });

        res.json(yritykset);
    } catch (error) {
        console.error('Virhe /api/yrityslista reitissä:', error.message);
        res.status(500).json({ error: 'Yrityslistan haku epäonnistui' });
    }
});


// --- TERVEISTEN HAKU (EI MUUTOKSIA) ---
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
