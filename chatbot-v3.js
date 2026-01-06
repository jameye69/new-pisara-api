(function() {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'pisara-chat-box';
    chatContainer.innerHTML = `
        <div id="chat-button" style="background: #f4ede7; color: #151515; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid #ccc; box-shadow: 0 4px 10px rgba(0,0,0,0.2); font-size: 24px; font-weight: bold; position: absolute; bottom: 0; right: 0;">
            📦
        </div>
        <div id="chat-window" style="display: none; position: absolute; bottom: 70px; right: 0; width: 300px; border: 1px solid #ccc; background: white; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); overflow: hidden; flex-direction: column;">
            <div id="chat-header" style="background: #f4ede7; color: #151515; padding: 15px; font-weight: bold; text-align: center; border-bottom: 1px solid #ccc; display: flex; justify-content: space-between; align-items: center;">
                <span>Tilausseuranta</span>
                <span id="close-chat" style="cursor: pointer; font-size: 20px;">×</span>
            </div>
            <div id="chat-messages" style="height: 200px; overflow-y: auto; padding: 15px; font-size: 14px; color: #333;">
                <p>Hei! Syötä tiedot seurataksesi tilaustasi.</p>
            </div>
            <div id="chat-input-area" style="padding: 15px; border-top: 1px solid #eee; background: #f9f9f9;">
                <input type="text" id="order-number" placeholder="Tilausnumero (#nba-2460)" style="width: 100%; padding: 10px; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 14px;">
                <input type="email" id="customer-email" placeholder="Sähköpostiosoite" style="width: 100%; padding: 10px; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 14px;">
                <button onclick="searchOrder()" style="background: #151515; color: white; width: 100%; border: none; padding: 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">Etsi tilaus</button>
            </div>
        </div>
    `;
    document.body.appendChild(chatContainer);

    // Säiliön perusasetukset
    Object.assign(chatContainer.style, {
        position: 'fixed',
        bottom: '90px', // Nostetaan Jotform-agentin yläpuolelle
        right: '20px',
        zIndex: '10000',
        fontFamily: 'Arial, sans-serif'
    });

    // Mobiilisäädöt
    const style = document.createElement('style');
    style.innerHTML = `
        @media screen and (max-width: 480px) {
            #chat-window { width: 85vw !important; right: -10px !important; }
        }
    `;
    document.head.appendChild(style);

    const chatButton = document.getElementById('chat-button');
    const chatWindow = document.getElementById('chat-window');
    const closeChat = document.getElementById('close-chat');

    chatButton.onclick = () => {
        chatWindow.style.display = 'flex';
        chatButton.style.display = 'none';
    };

    closeChat.onclick = () => {
        chatWindow.style.display = 'none';
        chatButton.style.display = 'flex';
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
        msgDiv.innerHTML = `<p style="padding: 10px; background: #f0f0f0; border-radius: 4px; margin-top: 5px; line-height: 1.4;">${data.viesti}</p>`;
    } catch (e) {
        msgDiv.innerHTML = `<p style="color: red;">Yhteysvirhe. Yritä uudelleen.</p>`;
    }
}
