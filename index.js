// LOPULLINEN JA TOIMIVA BACKEND-KOODI (V6.4 - Eri Sheet ID haasteille)
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Määritellään sallitut osoitteet
const allowedOrigins = [
  'https://pisara25.fi',
  'https://www.pisara25.fi', // Lisätty www-versio
  'https://neulonbyajastamo.fi',
  'https://www.neulonbyajastamo.fi', // Lisätty www-versio
  'http://localhost:3000',
  'http://localhost:8080'
];

app.use(cors({
  origin: function (origin, callback) {
    // Salli pyynnöt ilman originia JA sallitut originsit
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Ei sallittu CORS-käytännön vuoksi'));
    }
  }
}));


const parseNumberArray = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(v => parseFloat(String(v).replace(',', '.')) || 0);
};

// Apufunktio, joka hakee datan ja muuttaa sen objekteiksi otsikkorivin perusteella.
const fetchAndParseSheetData = async (auth, spreadsheetId, range) => {
    // Varmistetaan, että auth ja spreadsheetId ovat olemassa ennen API-kutsua
    if (!auth || !spreadsheetId) {
        throw new Error('API-avain tai Spreadsheet ID puuttuu fetchAndParseSheetData-kutsusta.');
    }
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const values = response.data.values || [];

    if (values.length < 2) return []; // Vaatii otsikkorivin ja väh. yhden datarivin

    const headers = values[0];
    const dataRows = values.slice(1);

    return dataRows.map(row => {
        const rowData = {};
        headers.forEach((header, index) => {
            // Käytetään headeria sellaisenaan (ilman trim()), jos se voi sisältää välilyöntejä
            rowData[header] = row[index] || '';
        });
        return rowData;
    });
};

app.get('/api/data', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID; // Käyttää yleistä ID:tä
        const API_KEY = process.env.GOOGLE_API_KEY;

        if (!SPREADSHEET_ID || !API_KEY) {
            console.error('Virhe /api/data: SPREADSHEET_ID tai GOOGLE_API_KEY puuttuu ympäristömuuttujista.');
            return res.status(500).json({ error: 'Palvelimen konfiguraatiovirhe.' });
        }

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
        if (!valueRanges || valueRanges.length < 6) {
           console.error('Virhe /api/data: Kaikkia odotettuja arvoalueita ei saatu Sheetsistä.');
           return res.status(500).json({ error: 'Datan haku Sheetsistä epäonnistui osittain.' });
       }
        const getCounterValue = (idx) => parseFloat(String(valueRanges[idx]?.values?.[0]?.[0] || '0').replace(',', '.')) || 0;

        const chartValues = valueRanges[0]?.values || []; // Lisätty ?-operaattori
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
        console.error('Virhe /api/data reitissä:', error.message, error.stack); // Lisätty stack trace
        res.status(500).json({ error: 'Päädatan haku epäonnistui' });
    }
});

app.get('/api/yrityskaavio', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID; // Käyttää yleistä ID:tä
        const API_KEY = process.env.GOOGLE_API_KEY;

        if (!SPREADSHEET_ID || !API_KEY) {
            console.error('Virhe /api/yrityskaavio: SPREADSHEET_ID tai GOOGLE_API_KEY puuttuu ympäristömuuttujista.');
            return res.status(500).json({ error: 'Palvelimen konfiguraatiovirhe.' });
        }

        const sheets = google.sheets({ version: 'v4', auth: API_KEY });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Yrityksille!T1:X2',
        });
        
        const chartValues = response.data.values || [];
        if (chartValues.length < 2) {
             console.warn('/api/yrityskaavio: Odotettua vähemmän rivejä Sheetsistä (Labels/Kpl).');
             // Palautetaan tyhjää dataa, jotta frontend ei kaadu
             return res.json({ labels: [], ostojenMaara: [], suhdeluku: [] });
        }
        const labels = chartValues[0] || [];
        const ostojenMaara = parseNumberArray(chartValues[1]);
        
        const KUNTIEN_VAKILUVUT = {
            "Inkoo": 5407,
            "Kirkkonummi": 41015,
            "Lohja": 45855,
            "Siuntio": 6175,
            "Vihti": 29018
        };

        const suhdeluvut = labels.map(kuntaNimi => KUNTIEN_VAKILUVUT[kuntaNimi] || 0);

        res.json({
            labels: labels,
            ostojenMaara: ostojenMaara,
            suhdeluku: suhdeluvut
        });

    } catch (error) {
        console.error('Virhe /api/yrityskaavio reitissä:', error.message, error.stack); // Lisätty stack trace
        res.status(500).json({ error: 'Yrityskaavion datan haku epäonnistui' });
    }
});


app.get('/api/yrityslista', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID; // Käyttää yleistä ID:tä
        const API_KEY = process.env.GOOGLE_API_KEY;

        if (!SPREADSHEET_ID || !API_KEY) {
            console.error('Virhe /api/yrityslista: SPREADSHEET_ID tai GOOGLE_API_KEY puuttuu ympäristömuuttujista.');
            return res.status(500).json({ error: 'Palvelimen konfiguraatiovirhe.' });
        }

        const yrityksetData = await fetchAndParseSheetData(API_KEY, SPREADSHEET_ID, 'Yrityksille!A:Z');
        
        const yritykset = yrityksetData
            .filter(row => row['Yritys/yhteisö'] && row['Tietonsa julkistaneet mukana olevat yritykset']) // Käytetään tarkkaa header-nimeä
            .map(row => ({
                nimi: row['Tietonsa julkistaneet mukana olevat yritykset'] || '', 
                tervehdys: (row['Tervehdys_Hyväksytty'] && String(row['Tervehdys_Hyväksytty']).trim().toLowerCase() === 'k') 
                            ? (row['Terveiset / onnittelut'] || '') // Käytetään tarkkaa header-nimeä
                            : ''
            }));

        res.json(yritykset);
    } catch (error) {
        console.error('Virhe /api/yrityslista reitissä:', error.message, error.stack); // Lisätty stack trace
        res.status(500).json({ error: 'Yrityslistan haku epäonnistui' });
    }
});

app.get('/api/terveiset', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID; // Käyttää yleistä ID:tä
        const API_KEY = process.env.GOOGLE_API_KEY;

        if (!SPREADSHEET_ID || !API_KEY) {
            console.error('Virhe /api/terveiset: SPREADSHEET_ID tai GOOGLE_API_KEY puuttuu ympäristömuuttujista.');
            return res.status(500).json({ error: 'Palvelimen konfiguraatiovirhe.' });
        }

        const kaikkiData = await fetchAndParseSheetData(API_KEY, SPREADSHEET_ID, 'Vastaukset!A:Z');
        
        const terveiset = kaikkiData
            .filter(row => row['Hyväksytty'] && String(row['Hyväksytty']).trim().toLowerCase() === 'k') // Käytetään tarkkaa header-nimeä
            .map(row => ({
                aikaleima: row['Aikaleima'] || '', // Käytetään tarkkaa header-nimeä
                tervehdys: row['Tervehdys'] || '', // Käytetään tarkkaa header-nimeä
                kunta: row['Kunta'] || '' // Käytetään tarkkaa header-nimeä
            }));

        res.json(terveiset);
    } catch (error) {
        console.error('Virhe /api/terveiset reitissä:', error.message, error.stack); // Lisätty stack trace
        res.status(500).json({ error: 'Terveisten haku epäonnistui' });
    }
});

// UUSI REitti haasteiden hakemiseen
app.get('/api/haasteet', async (req, res) => {
    try {
        // === MUUTOS TÄSSÄ ===
        // Luetaan oma ympäristömuuttuja haasteiden Sheet ID:lle
        const HAASTE_SPREADSHEET_ID = process.env.HAASTE_SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;

        // Varmistetaan, että molemmat muuttujat on asetettu
        if (!HAASTE_SPREADSHEET_ID || !API_KEY) {
            console.error('Virhe /api/haasteet: HAASTE_SPREADSHEET_ID tai GOOGLE_API_KEY puuttuu ympäristömuuttujista.');
            return res.status(500).json({ error: 'Palvelimen konfiguraatiovirhe.' });
        }
        // === MUUTOS PÄÄTTYY ===

        const range = 'Haaste!A:B'; // Tämä on nyt oikein

        const sheets = google.sheets({ version: 'v4', auth: API_KEY });
        const response = await sheets.spreadsheets.values.get({
            // === MUUTOS TÄSSÄ ===
            spreadsheetId: HAASTE_SPREADSHEET_ID, // Käytetään uutta ID:tä
            // === MUUTOS PÄÄTTYY ===
            range: range,
        });

        const rows = response.data.values || [];

        if (rows.length < 2) {
             console.warn('/api/haasteet: Haaste-välilehdellä ei ole tarpeeksi dataa (otsikko + rivit).');
             return res.json([]); // Palautetaan tyhjä taulukko
        }

        const haasteet = rows.slice(1).map(row => {
            const haastaja = row && row[0] ? String(row[0]).trim() : '';
            const haastettava = row && row[1] ? String(row[1]).trim() : '';
            if (haastaja && haastettava) {
                return { haastaja: haastaja, haastettava: haastettava };
            }
            return null;
        }).filter(haaste => haaste !== null);

        haasteet.reverse(); // Uusin ensin

        res.json(haasteet);

    } catch (error) {
        console.error('Virhe /api/haasteet reitissä:', error.message, error.stack); // Lisätty stack trace
        res.status(500).json({ error: 'Haasteiden haku epäonnistui' });
    }
});


app.listen(PORT, () => {
    console.log(`Palvelin käynnissä portissa ${PORT}`);
});
// --- SHOP_BOTIN TILAUSHAKU ALKAA ---
// Tämä reitti vastaa kyselyihin osoitteessa /api/chatbot/tilaus
app.get('/api/chatbot/tilaus', async (req, res) => {
    const { numero, email } = req.query;
    
    if (!numero || !email) {
        return res.status(400).json({ viesti: "Tilausnumero ja sähköposti puuttuvat." });
    }

    try {
        // Haetaan tilaus Shopifysta käyttämällä Renderiin tallennettuja muuttujia
        const response = await axios.get(`https://${process.env.SHOPIFY_DOMAIN}/admin/api/2024-01/orders.json?name=${numero}&status=any`, {
            headers: { 
                'X-Shopify-Access-Token': process.env.SHOPIFY_API_SECRET,
                'Content-Type': 'application/json'
            }
        });

        // Etsitään listasta tilaus, jonka sähköposti täsmää
        const tilaus = response.data.orders.find(o => o.email.toLowerCase() === email.toLowerCase());

        if (tilaus) {
            // Suomennetaan tilat asiakkaalle sopiviksi
            let tila = "Käsittelyssä";
            if (tilaus.fulfillment_status === 'fulfilled') tila = "Lähetetty";
            if (tilaus.cancelled_at) tila = "Peruttu";

            res.json({ viesti: `Tilauksesi (${tilaus.name}) tila on: ${tila}.` });
        } else {
            res.json({ viesti: "Tilausta ei löytynyt tällä numerolla ja sähköpostilla." });
        }
    } catch (e) {
        console.error("Shopify-virhe:", e.message);
        res.status(500).json({ viesti: "Yhteys kauppaan epäonnistui. Kokeile myöhemmin uudelleen." });
    }
});
// --- SHOP_BOTIN TILAUSHAKU PÄÄTTYY ---

