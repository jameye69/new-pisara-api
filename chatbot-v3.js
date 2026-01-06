(function() {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'pisara-chat-box';
    chatContainer.innerHTML = `
        <div id="chat-header" style="background: #151515; color: white; padding: 15px; cursor: pointer; border-radius: 8px 8px 0 0; font-weight: bold;">
            Pisara Apuri
        </div>
        <div id="chat-content" style="display: none; border: 1px solid #ccc; border-top: none; background: white; border-radius: 0 0 8px 8px;">
            <div id="chat-messages" style="height: 300px; overflow-y: auto; padding: 15px; font-size: 14px;">
                <p>Hei! Anna tilausnumerosi ja sähköpostisi, niin tarkistan tilauksen tilan.</p>
            </div>
            <div id="chat-input-area" style="padding: 15px; border-top: 1px solid #eee; background: #f9f9f9;">
                <input type="text" id="order-number" placeholder="Tilausnumero (esim. #2460)" style="width: 100%; padding: 8px; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <input type="email" id="customer-email" placeholder="Sähköposti" style="width: 100%; padding: 8px; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <button onclick="searchOrder()" style="background: #151515; color: white; width: 100%; border: none; padding: 10px; border-radius: 4px; cursor: pointer;">Etsi tilaus</button>
            </div>
        </div>
    `;
    document.body.appendChild(chatContainer);

    Object.assign(chatContainer.style, {
        position: 'fixed', bottom: '20px', right: '20px', width: '300px',
        zIndex: '1000', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', fontFamily: 'sans-serif'
    });

    document.getElementById('chat-header').onclick = () => {
        const content = document.getElementById('chat-content');
        content.style.display = content.style.display === 'block' ? 'none' : 'block';
    };
})();

async function searchOrder() {
    const num = document.getElementById('order-number').value.trim();
    const email = document.getElementById('customer-email').value.trim();
    const msgDiv = document.getElementById('chat-messages');

    if (!num || !email) return alert("Täytä molemmat kentät!");

    msgDiv.innerHTML += `<p><b>Etsitään tilausta ${num}...</b></p>`;
    
    try {
        const response = await fetch(`https://new-pisara-api.onrender.com/api/chatbot/tilaus?numero=${encodeURIComponent(num)}&email=${encodeURIComponent(email)}`);
        const data = await response.json();
        msgDiv.innerHTML += `<p style="padding: 8px; background: #f0f0f0; border-radius: 4px; margin-top: 5px;">${data.viesti}</p>`;
    } catch (e) {
        msgDiv.innerHTML += `<p style="color: red;">Yhteysvirhe. Yritä uudelleen.</p>`;
    }
    msgDiv.scrollTop = msgDiv.scrollHeight;
}
