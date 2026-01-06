// LOPULLINEN JA TOIMIVA BACKEND-KOODI (V6.6 - Shopify-varmistettu)
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// Määritellään sallitut osoitteet
const allowedOrigins = [
  'https://pisara25.fi',
  'https://www.pisara25.fi',
  'https://neulonbyajastamo.fi',
  'https://www.neulonbyajastamo.fi',
  'http://localhost:3000',
  'http://localhost:8080'
];

app.use(cors({
  origin: function (origin, callback) {
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

const fetchAndParseSheetData = async (auth, spreadsheetId, range) => {
    if (!auth || !spreadsheetId) {
        throw new Error('API-avain tai Spreadsheet ID puuttuu.');
    }
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const values = response.data.values || [];
    if (values.length < 2) return [];
    const headers = values[0];
    const dataRows = values.slice(1);
    return dataRows.map(row => {
        const rowData = {};
        headers.forEach((header, index) => {
            rowData[header] = row[index] || '';
        });
        return rowData;
    });
};

// Google Sheets -reitit ennallaan...
app.get('/api/data', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        if (!SPREADSHEET_ID || !API_KEY) return res.status(500).json({ error: 'Konfiguraatiovirhe.' });
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });
        const responses = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: SPREADSHEET_ID,
            ranges: ['Yksityiset!M1:Q3', 'Yksityiset!R4', 'Yksityiset!T2', 'Yrityksille!Z2', 'Yrityksille!Y2', 'Yksityiset!Z2']
        });
        const valueRanges = responses.data.valueRanges;
        const getCounterValue = (idx) => parseFloat(String(valueRanges[idx]?.values?.[0]?.[0] || '0').replace(',', '.')) || 0;
        const chartValues = valueRanges[0]?.values || [];
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
        res.status(500).json({ error: 'Datan haku epäonnistui' });
    }
});

app.get('/api/yrityskaavio', async (req, res) => {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Yrityksille!T1:X2',
        });
        const chartValues = response.data.values || [];
        const labels = chartValues[0] || [];
        const ostojenMaara = parseNumberArray(chartValues[1]);
        const KUNTIEN_VAKILUVUT = { "Inkoo": 5407, "Kirkkonummi": 41015, "Lohja": 45855, "Siuntio": 6175, "Vihti": 29018 };
        const suhdeluvut = labels.map(kuntaNimi => KUNTIEN_VAKILUVUT[kuntaNimi] || 0);
        res.json({ labels, ostojenMaara, suhdeluku: suhdeluvut });
    } catch (error) {
        res.status(500).json({ error: 'Kaavion haku epäonnistui' });
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
                tervehdys: (row['Tervehdys_Hyväksytty'] && String(row['Tervehdys_Hyväksytty']).trim().toLowerCase() === 'k') 
                            ? (row['Terveiset / onnittelut'] || '') : ''
            }));
        res.json(yritykset);
    } catch (error) {
        res.status(500).json({ error: 'Lista haku epäonnistui' });
    }
});

app.get('/api/haasteet', async (req, res) => {
    try {
        const HAASTE_SPREADSHEET_ID = process.env.HAASTE_SPREADSHEET_ID;
        const API_KEY = process.env.GOOGLE_API_KEY;
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: HAASTE_SPREADSHEET_ID,
            range: 'Haaste!A:B',
        });
        const rows = response.data.values || [];
        const haasteet = rows.slice(1).map(row => {
            if (row && row[0] && row[1]) return { haastaja: row[0].trim(), haastettava: row[1].trim() };
            return null;
        }).filter(h => h !== null);
        res.json(haasteet.reverse());
    } catch (error) {
        res.status(500).json({ error: 'Haastehaku epäonnistui' });
    }
});

// --- SHOP_BOTIN TILAUSHAKU ---
app.get('/api/chatbot/tilaus', async (req, res) => {
    const { numero, email } = req.query;
    const shop = process.env.SHOP_URL || "neulon-by-ajastamo.myshopify.com";
    const token = process.env.SHOPIFY_API_SECRET; 

    if (!numero || !email) {
        return res.status(400).json({ viesti: "Tilausnumero ja sähköposti puuttuvat." });
    }

    try {
        const response = await axios.get(`https://${shop}/admin/api/2024-01/orders.json?name=${encodeURIComponent(numero)}&status=any`, {
            headers: { 
                'X-Shopify-Access-Token': token,
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.orders) {
            const tilaus = response.data.orders.find(o => o.email.toLowerCase() === email.toLowerCase());
            if (tilaus) {
                let tila = "Käsittelyssä";
                if (tilaus.fulfillment_status === 'fulfilled') tila = "Lähetetty";
                if (tilaus.cancelled_at) tila = "Peruttu";
                return res.json({ viesti: `Tilauksesi (${tilaus.name}) tila on: ${tila}.` });
            }
        }
        res.json({ viesti: "Tilausta ei löytynyt näillä tiedoilla. Tarkista numero (esim. #1001)." });
    } catch (e) {
        console.error("Shopify-virhe:", e.message);
        res.status(500).json({ viesti: "Yhteys kauppaan vaatii valtuutuksen osoitteessa /auth" });
    }
});

// Aktivoi yhteys
app.get('/auth', (req, res) => {
    const shop = process.env.SHOP_URL || "neulon-by-ajastamo.myshopify.com";
    const apiKey = process.env.SHOPIFY_API_KEY;
    // Käytetään Renderin host-nimeä ja pakotetaan https
    const host = req.get('host');
    const redirectUri = `https://${host}/auth/callback`;
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=read_orders&redirect_uri=${redirectUri}`;
    res.redirect(installUrl);
});

app.get('/auth/callback', (req, res) => {
    res.send("Yhteys muodostettu! Voit nyt testata tilaushakua.");
});

app.listen(PORT, () => {
    console.log(`Palvelin käynnissä portissa ${PORT}`);
});
// Päivitetty auth/callback-reitti
app.get('/auth/callback', async (req, res) => {
    const { shop, code } = req.query;
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET; // Tässä on oltava shpss-alkuinen koodi

    try {
        const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: apiKey,
            client_secret: apiSecret,
            code
        });
        
        // TÄMÄ ON SE RATKAISEVA RIVI:
        console.log("KOPIOI TÄMÄ RENDERIIN (shpat_...):", response.data.access_token);
        
        res.send("Valtuutus onnistui! Katso shpat-koodi Renderin lokeista (Logs) ja päivitä se Environment-asetuksiin.");
    } catch (e) {
        console.error("Valtuutusvirhe:", e.response ? e.response.data : e.message);
        res.status(500).send("Virhe valtuutuksessa.");
    }
});
