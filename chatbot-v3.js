(function() {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'pisara-chat-box';
    chatContainer.innerHTML = `
        <div id="chat-header" style="background: #f4ede7; color: #151515; padding: 15px; cursor: pointer; border-radius: 8px 8px 0 0; font-weight: bold; text-align: center; border: 1px solid #ccc; border-bottom: none;">
            Tilausseuranta
        </div>
        <div id="chat-content" style="display: none; border: 1px solid #ccc; border-top: none; background: white; border-radius: 0 0 8px 8px;">
            <div id="chat-messages" style="height: 250px; overflow-y: auto; padding: 15px; font-size: 14px; color: #333;">
                <p>Hei! Syötä tilausnumerosi ja sähköpostiosoitteesi seurataksesi tilauksesi tilaa Neulon by Ajastamo -kaupassa.</p>
            </div>
            <div id="chat-input-area" style="padding: 15px; border-top: 1px solid #eee; background: #f9f9f9;">
                <input type="text" id="order-number" placeholder="Tilausnumero (esim. #nba-2460)" style="width: 100%; padding: 10px; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
                <input type="email" id="customer-email" placeholder="Sähköpostiosoite" style="width: 100%; padding: 10px; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
                <button onclick="searchOrder()" style="background: #151515; color: white; width: 100%; border: none; padding: 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">Etsi tilaus</button>
            </div>
        </div>
    `;
    document.body.appendChild(chatContainer);

    Object.assign(chatContainer.style, {
        position: 'fixed', bottom: '20px', right: '20px', width: '320px',
        zIndex: '10000', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', fontFamily: 'Arial, sans-serif'
    });

    document.getElementById('chat-header').onclick = () => {
        const content = document.getElementById('chat-content');
        content.style.display = content.style.display === 'block' ? 'none' : 'block';
    };
})();

async function searchOrder() {
    let num = document.getElementById('order-number').value.trim();
    const email = document.getElementById('customer-email').value.trim();
    const msgDiv = document.getElementById('chat-messages');

    if (!num || !email) return alert("Täytä molemmat kentät!");

    msgDiv.innerHTML = `<p><b>Etsitään tilausta ${num}...</b></p>`;
    
    try {
        const response = await fetch(`https://new-pisara-api.onrender.com/api/chatbot/tilaus?numero=${encodeURIComponent(num)}&email=${encodeURIComponent(email)}`);
        const data = await response.json();
        msgDiv.innerHTML = `<p style="padding: 10px; background: #f0f0f0; border-radius: 4px; margin-top: 5px; line-height: 1.4;">${data.viesti}</p>`;
    } catch (e) {
        msgDiv.innerHTML = `<p style="color: red;">Yhteysvirhe seurantaan. Yritä uudelleen hetken kuluttua.</p>`;
    }
}
