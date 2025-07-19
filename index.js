// ... (koodin alku pysyy samana) ...

app.get('/api/data', async (req, res) => {
  try {
    // ... (API-avaimen ja ID:n haku pysyy samana) ...
    
    const sheets = google.sheets({ version: 'v4', auth: API_KEY });

    const responses = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [
        'Yksityiset!M1:Q3',  // Kaavion data
        'Yksityiset!R4',     // Laskuri: Yksityiset kpl
        'Yksityiset!T2',     // Laskuri: Yksityiset €
        'Yrityksille!X2',    // Laskuri: Yritykset kpl
        'Yrityksille!W2'     // Laskuri: Yritykset €
      ]
    });

    const valueRanges = responses.data.valueRanges;

    // --- Kaavion datan käsittely (Nimetty selkeämmin) ---
    const chartValues = valueRanges[0].values || [];
    const formattedChart = {
      labels:       chartValues.length > 0 ? chartValues[0] : [],
      ostojenMaara: chartValues.length > 1 ? chartValues[1].map(v => parseFloat(String(v).replace(',', '.')) || 0) : [], // MUUTETTU NIMI
      suhdeluku:    chartValues.length > 2 ? chartValues[2].map(v => parseFloat(String(v).replace(',', '.')) || 0) : []  // MUUTETTU NIMI
    };
    
    // ... (laskurien käsittely ja koodin loppu pysyy samana) ...
    // ...
    res.json({
      chart: formattedChart,
      counters: formattedCounters
    });

  } catch (error) {
    // ...
  }
});

// ... (muut reitit ja app.listen pysyy samana) ...
