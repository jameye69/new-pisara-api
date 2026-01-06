(function() {
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Funnel+Display:wght@400;700&display=swap';
    document.head.appendChild(fontLink);

    const chatContainer = document.createElement('div');
    chatContainer.id = 'pisara-chat-box';
    chatContainer.innerHTML = `
        <div id="chat-button" style="background: #f4ede7; color: #151515; width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid #ccc; box-shadow: 0 4px 10px rgba(0,0,0,0.2); font-size: 20px; position: absolute; bottom: 0; right: 0; transition: transform 0.2s ease;">
            📦
        </div>
        <div id="chat-window" style="display: none; position: absolute; bottom: 0; right: 0; width: 260px; border: 1px solid #ccc; background: white; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); overflow: hidden; flex-direction: column;">
            <div id="chat-header" style="background: #f4ede7; color: #151515; padding: 12px; font-weight: bold; text-align: center; border-bottom: 1px solid #ccc; display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-family: 'Funnel Display', sans-serif;">
                <span>Tilausseuranta</span>
                <span id="close-chat" style="cursor: pointer; font-size: 18px; line-height: 1;">×</span>
            </div>
            <div id="chat-messages" style="height: 180px; overflow-y: auto; padding: 12px; font-size: 14px; color: #333; font-family: 'Funnel Display', sans-serif;">
                <p>Hei! Syötä tiedot seurataksesi tilaustasi.</p>
            </div>
            <div id="chat-input-area" style="padding: 12px; border-top: 1px solid #eee; background: #f9f9f9; font-family: 'Funnel Display', sans-serif;">
                <input type="text" id="order-number" placeholder="Tilausnumero (#nba-2460)" style="width: 100%; padding: 8px; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 14px; font-family: 'Funnel Display', sans-serif;">
                <input type="email" id="customer-email" placeholder="Sähköpostiosoite" style="width: 100%; padding: 8px; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 14px; font-family: 'Funnel Display', sans-serif;">
                <button onclick="searchOrder()" style="background: #151515; color: white; width: 100%; border: none; padding: 10px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px; font-family: 'Funnel Display', sans-serif;">Etsi tilaus</button>
            </div>
        </div>
    `;
    document.body.appendChild(chatContainer);

    Object.assign(chatContainer.style, {
        position: 'fixed',
        bottom: '85px', 
        right: '18px', 
        width: '45px',
        zIndex: '10000',
        fontFamily: "'Funnel Display', sans-serif"
    });

    const style = document.createElement('style');
    style.innerHTML = `
        @media screen and (max-width: 480px) {
            #chat-window { 
                width: 240px !important; 
                right: -5px !important;
            }
        }
        #chat-button:hover { transform: scale(1.05); }

        /* TÄMÄ PIILOTTAA JOTFORMIN TERVEHDYKSEN VÄKISIN */
        .jfAgent-greeting, 
        .jfAgent-bubble, 
        [class*="greeting"], 
        [class*="jf-agent-welcome"] { 
            display: none !important; 
            opacity: 0 !important; 
            visibility: hidden !important; 
            pointer-events: none !important;
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
        msgDiv.innerHTML = `<p style="padding: 10px; background: #f0f0f0; border-radius: 4px; margin-top: 5px; line-height: 1.4; font-size: 14px;">${data.viesti}</p>`;
    } catch (e) {
        msgDiv.innerHTML = `<p style="color: red; font-size: 14px;">Yhteysvirhe. Yritä uudelleen.</p>`;
    }
}
