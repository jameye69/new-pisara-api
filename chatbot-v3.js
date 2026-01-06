(function() {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'pisara-chat-box';
    chatContainer.innerHTML = `
        <div id="chat-header" style="background: #f4ede7; color: #151515; padding: 10px 15px; cursor: pointer; border-radius: 8px 8px 0 0; font-weight: bold; text-align: center; border: 1px solid #ccc; border-bottom: none; font-size: 14px;">
            Tilausseuranta
        </div>
        <div id="chat-content" style="display: none; border: 1px solid #ccc; border-top: none; background: white; border-radius: 0 0 8px 8px;">
            <div id="chat-messages" style="height: 250px; overflow-y: auto; padding: 15px; font-size: 13px; color: #333;">
                <p>Hei! Syötä tilausnumerosi ja sähköpostisi seurataksesi tilausta.</p>
            </div>
            <div id="chat-input-area" style="padding: 12px; border-top: 1px solid #eee; background: #f9f9f9; display: flex; flex-direction: column;">
                <input type="text" id="order-number" placeholder="Tilausnumero (esim. #nba-2460)" style="width: 100%; padding: 8px; margin-bottom: 6px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 13px;">
                <input type="email" id="customer-email" placeholder="Sähköpostiosoite" style="width: 100%; padding: 8px; margin-bottom: 6px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 13px;">
                <button onclick="searchOrder()" style="background: #151515; color: white; width: 100%; border: none; padding: 10px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px;">Etsi tilaus</button>
            </div>
        </div>
    `;
    document.body.appendChild(chatContainer);

    // Asettelu: Aivan oikeaan alareunaan, sirompi leveys
    Object.assign(chatContainer.style, {
        position: 'fixed', 
        bottom: '15px', 
        right: '15px', 
        width: '250px',
        zIndex: '9998', 
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)', 
        fontFamily: 'Arial, sans-serif'
    });

    document.getElementById('chat-header').onclick = () => {
        const content = document.getElementById('chat-content');
        const isOpen = content.style.display === 'block';
        content.style.display = isOpen ? 'none' : 'block';
    };
})();

async function searchOrder() {
    let num = document.getElementById('order-number').value.trim();
    const email = document.getElementById('customer-email').value.trim();
    const msgDiv = document.getElementById('chat-messages');

    if (!num) return alert("Syötä tilausnumero!");

    msgDiv.innerHTML = `<p><b>Etsitään tilausta ${num}...</b></p>`;
    
    try {
        const response = await fetch(`https://new-pisara-api.onrender.com/api/chatbot/tilaus?numero=${encodeURIComponent(num)}&email=${encodeURIComponent(email)}`);
        const data = await response.json();
        msgDiv.innerHTML = `<p style="padding: 10px; background: #f0f0f0; border-radius: 4px; margin-top: 5px; line-height: 1.4; font-size: 13px;">${data.viesti}</p>`;
    } catch (e) {
        msgDiv.innerHTML = `<p style="color: red; font-size: 13px;">Yhteysvirhe. Yritä uudelleen.</p>`;
    }
}
