/**
 * messageManagement.js
 * Advanced Chat / Messenger interface for WanderViệt Business.
 * Tích hợp Trợ lý AI v5.0 (Learning & Advanced Flow).
 */

(function() {
    'use strict';

    let activeConvId = null;
    let localMessages = [];
    let localConversations = [];
    
    // Hệ thống Trí nhớ & Phiên
    let aiMemory = JSON.parse(localStorage.getItem('chatbot_memory_v5') || '{}');
    let aiSession = { step: 'idle', data: {} };

    const HISTORY_KEY = 'chatbot_history_messages_v5';
    const AI_BOT_ID = 'ai-assistant';

    // ── Logic AI Thông minh ──────────────────────────────────────
    function normalize(text) {
        if (!text) return '';
        return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();
    }

    function getBotReply(userMessage) {
        const raw = userMessage;
        const clean = normalize(raw);

        // 1. Cú pháp Dạy học (Learning)
        if (raw.toLowerCase().startsWith('day:')) {
            const parts = raw.substring(4).split('=');
            if (parts.length === 2) {
                const k = normalize(parts[0]);
                const v = parts[1].trim();
                aiMemory[k] = v;
                localStorage.setItem('chatbot_memory_v5', JSON.stringify(aiMemory));
                return `Đã học! Từ giờ khi nhắc đến '${k}', em sẽ trả lời: '${v}'`;
            }
        }

        // 2. Ưu tiên Trí nhớ đã học
        for (let k in aiMemory) {
            if (clean.includes(k)) return aiMemory[k];
        }

        // 3. Luồng Hội thoại (Flow)
        if (aiSession.step === 'asking_people') {
            const num = raw.match(/\d+/);
            if (num) {
                aiSession.step = 'asking_date';
                aiSession.data.people = num[0];
                return `Dạ, em ghi nhận đặt cho ${num[0]} người. Vậy mình dự định khởi hành/nhận phòng vào ngày nào ạ?`;
            }
            return "Dạ mình đi mấy người để em kiểm tra chỗ ạ?";
        }

        if (aiSession.step === 'asking_date') {
            aiSession.step = 'asking_phone';
            aiSession.data.date = raw;
            return `Ngày ${raw} bên em vẫn còn dịch vụ ạ. Bạn cho em xin số điện thoại để em giữ chỗ cho mình nhé!`;
        }

        if (aiSession.step === 'asking_phone') {
            const phone = raw.match(/\d{9,11}/);
            if (phone) {
                aiSession = { step: 'idle', data: {} };
                return `Tuyệt vời! Em đã nhận số ${phone[0]}. Nhân viên sẽ gọi lại tư vấn chi tiết cho mình trong ít phút nữa ạ. Cảm ơn bạn! 😊`;
            }
            return "Dạ cho em xin số điện thoại để liên hệ xác nhận ạ.";
        }

        // 4. Intent Detection
        const intents = {
            services: ["dich vu", "co gi", "lam gi", "san pham", "tien ich"],
            booking: ["dat phong", "thue phong", "book", "dat cho", "nghi"],
            tour: ["tour", "du lich", "di choi"],
            price: ["gia", "bao nhieu", "bao tien", "chi phi"]
        };

        if (intents.services.some(k => clean.includes(k))) {
            return "Dạ bên em cung cấp 2 dịch vụ chính: \n1. **Đặt phòng khách sạn/Resort** cao cấp view biển. \n2. **Tour du lịch trọn gói** (Hạ Long, Đà Nẵng, Hội An). \nBạn muốn tìm hiểu kỹ hơn về dịch vụ nào ạ?";
        }

        if (intents.booking.some(k => clean.includes(k)) || clean.includes("phong")) {
            aiSession.step = 'asking_people';
            return "Dạ em hỗ trợ mình đặt phòng ạ. Mình dự định đi mấy người để em tư vấn hạng phòng phù hợp nhất?";
        }

        if (intents.tour.some(k => clean.includes(k))) {
            aiSession.step = 'asking_people';
            return "Dạ em hỗ trợ đặt tour ạ. Mình đi đoàn mấy người để em báo giá ưu đãi nhất?";
        }

        if (intents.price.some(k => clean.includes(k))) {
            return "Dạ giá bên em rất linh hoạt: Tour từ 1.8tr/người và Phòng từ 1.2tr/đêm. Bạn muốn em gửi bảng giá chi tiết của dịch vụ nào ạ?";
        }

        return "Dạ em chưa hiểu rõ ý mình lắm. Bạn muốn xem danh sách **dịch vụ**, **đặt phòng** hay hỏi về **giá cả** ạ?";
    }

    // ── Styles (Premium & Smooth Scroll) ─────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        .msg-mgmt-container { width: 100%; height: 550px; display: flex; flex-direction: column; font-family: 'Plus Jakarta Sans', sans-serif; overflow: hidden; background: #fff; margin-bottom: 30px; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
        .messenger-layout { display: grid; grid-template-columns: 300px 1fr; background: #fff; height: 100%; overflow: hidden; }
        
        .msg-sidebar { border-right: 1px solid #f1f5f9; display: flex; flex-direction: column; background: #f8fafc; height: 100%; }
        .sidebar-head { padding: 15px 20px; border-bottom: 1px solid #f1f5f9; background: #fff; flex-shrink: 0; }
        .conv-list { flex: 1; overflow-y: auto; padding: 10px; }
        
        .conv-item { display: flex; align-items: center; gap: 18px; padding: 18px; border-radius: 22px; cursor: pointer; transition: all 0.3s; margin-bottom: 10px; }
        .conv-item.active { background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%); color: #fff; }
        
        .chat-main { display: flex; flex-direction: column; height: 100%; background: #fff; overflow: hidden; }
        .chat-header { padding: 12px 20px; border-bottom: 1px solid #f1f5f9; background: #fff; flex-shrink: 0; }
        .chat-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px; background: #fff; scroll-behavior: smooth; }
        .chat-messages::after { content: ""; display: block; height: 60px; width: 100%; flex-shrink: 0; }
        
        .bubble { max-width: 75%; padding: 16px 24px; font-size: 15px; line-height: 1.6; border-radius: 24px; position: relative; animation: slideIn 0.4s ease-out; }
        .bubble-in { align-self: flex-start; background: #fff; color: #1e293b; border-bottom-left-radius: 4px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); border: 1px solid #f1f5f9; }
        .bubble-out { align-self: flex-end; background: #4338ca; color: #fff; border-bottom-right-radius: 4px; }
        .bubble-ai { background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%); color: #fff; border: none; }
        
        .chat-input-area { padding: 18px 25px; border-top: 2px solid #f1f5f9; display: flex; align-items: center; gap: 15px; background: #f8fafc; flex-shrink: 0; }
        .chat-input { flex: 1; padding: 14px 22px; border-radius: 12px; border: 2px solid #cbd5e1; outline: none; background: #fff; font-size: 15px; }
        .btn-send { width: 48px; height: 48px; border-radius: 12px; background: #4338ca; color: #fff; border: none; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; }

        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);

    // ── Scroll Logic (Final Fix) ─────────────────────────────────
    function forceScrollToBottom() {
        const container = document.getElementById('chat-messages-container');
        if (!container) return;
        
        const doScroll = () => {
            container.scrollTop = container.scrollHeight + 1000;
            const lastMsg = container.lastElementChild;
            if (lastMsg) lastMsg.scrollIntoView({ behavior: 'smooth', block: 'end' });
        };

        doScroll();
        setTimeout(doScroll, 50);
        setTimeout(doScroll, 150);
        setTimeout(doScroll, 400);
    }

    // ── Initialization ──────────────────────────────────────────
    window.initMessageManagement = function() {
        localMessages = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        localConversations = [
            { id: AI_BOT_ID, customerName: 'Trợ lý Tư vấn Chuyên nghiệp', avatar: '👩‍💼', status: 'online', lastMessage: 'Em có thể giúp gì cho mình ạ?', time: 'Online', isAI: true },
            { id: 'c-1', customerName: 'Nguyễn Văn A', avatar: 'https://i.pravatar.cc/150?u=1', status: 'online', lastMessage: 'Báo giá cho mình nhé', time: '10:30' }
        ];

        const container = document.getElementById('message-mgmt-container');
        if (!container) return;

        container.innerHTML = `
            <div class="msg-mgmt-container">
                <div class="messenger-layout">
                    <div class="msg-sidebar">
                        <div class="sidebar-head"><h2 style="font-weight:900; color:#1e1b4b;">Hỗ trợ khách hàng</h2></div>
                        <div class="conv-list" id="conv-list"></div>
                    </div>
                    <div class="msg-main" id="chat-main-view">
                        <div style="flex:1; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:25px; text-align:center; height:100%; background:#fcfcfd;">
                            <div style="font-size:80px; background:#eef2ff; width:150px; height:150px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#4338ca;">👩‍💼</div>
                            <h2 style="font-weight:900; color:#1e1b4b;">Trung tâm Tư vấn Thông minh</h2>
                            <p style="color:#64748b; max-width:380px; font-size:16px;">Sẵn sàng hỗ trợ giải đáp mọi thắc mắc về tour và khách sạn.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        renderConversations();
    };

    function renderConversations() {
        const container = document.getElementById('conv-list');
        if (!container) return;
        container.innerHTML = localConversations.map(c => `
            <div class="conv-item ${activeConvId === c.id ? 'active' : ''}" onclick="window.selectConversation('${c.id}')">
                <div style="width:56px; height:56px; border-radius:18px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:28px;">
                    ${c.avatar.length > 2 ? `<img src="${c.avatar}" style="width:100%; height:100%; border-radius:18px; object-fit:cover;">` : c.avatar}
                </div>
                <div class="conv-info">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                        <span style="font-weight:800; font-size:16px;">${c.customerName}</span>
                        <span style="font-size:10px; opacity:0.7;">${c.time}</span>
                    </div>
                    <div style="font-size:13px; opacity:0.85;">${c.lastMessage}</div>
                </div>
            </div>
        `).join('');
    }

    window.selectConversation = function(id) {
        activeConvId = id;
        const conv = localConversations.find(c => c.id === id);
        renderConversations();

        const mainView = document.getElementById('chat-main-view');
        mainView.innerHTML = `
            <div class="chat-main">
                <div class="chat-header">
                    <div style="display:flex; align-items:center; gap:18px;">
                        <div style="font-size:24px;">${conv.avatar.length > 2 ? `<img src="${conv.avatar}" style="width:52px; height:52px; border-radius:16px; object-fit:cover;">` : conv.avatar}</div>
                        <div>
                            <div style="font-weight:900; color:#1e1b4b; font-size:17px;">${conv.customerName}</div>
                            <div style="font-size:12px; color:#10b981; font-weight:700;">Đang trực tuyến ⚡</div>
                        </div>
                    </div>
                    <button onclick="localStorage.removeItem('${HISTORY_KEY}'); aiSession={step:'idle',data:{}}; window.initMessageManagement(); setTimeout(()=>window.selectConversation('${AI_BOT_ID}'), 50);" style="font-size:12px; font-weight:700; color:#ef4444; background:#fef2f2; border:none; padding:10px 20px; border-radius:12px; cursor:pointer;">Làm mới Chat</button>
                </div>
                <div class="chat-messages" id="chat-messages-container"></div>
                <div class="chat-input-area">
                    <input type="text" placeholder="Nhập câu hỏi tại đây..." id="chat-input-field" class="chat-input">
                    <button onclick="window.handleSendMessage()" class="btn-send">➤</button>
                </div>
            </div>
        `;

        renderMessages(id, true);
        const input = document.getElementById('chat-input-field');
        if (input) {
            input.focus();
            input.addEventListener('keypress', (e) => { if (e.key === 'Enter') window.handleSendMessage(); });
        }
    };

    function renderMessages(convId, instantScroll = false) {
        const msgs = localMessages.filter(m => m.conversationId === convId);
        const container = document.getElementById('chat-messages-container');
        if (!container) return;

        if (msgs.length === 0 && convId === AI_BOT_ID) {
            msgs.push({ conversationId: AI_BOT_ID, sender: 'customer', content: 'Chào bạn! Em là trợ lý ảo hỗ trợ tư vấn dịch vụ. Bạn muốn tìm hiểu về **Tour du lịch** hay **Đặt phòng khách sạn** ạ?', time: 'Hệ thống' });
        }

        container.innerHTML = msgs.map(m => `
            <div class="bubble ${m.sender === 'customer' ? 'bubble-in' : 'bubble-out'} ${convId === AI_BOT_ID && m.sender === 'customer' ? 'bubble-ai' : ''}">
                ${m.content}
                <div style="font-size:9.5px; opacity:0.6; margin-top:8px; text-align:right; font-weight:600;">${m.time}</div>
            </div>
        `).join('');

        forceScrollToBottom();
    }

    function nowStr() {
        const now = new Date();
        return now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
    }

    window.handleSendMessage = function() {
        const input = document.getElementById('chat-input-field');
        if (!input || !activeConvId) return;

        const content = input.value.trim();
        if (!content) return;

        // 1. Thêm tin nhắn của User ngay lập tức
        localMessages.push({ id: Date.now(), conversationId: activeConvId, sender: 'business', content, time: nowStr() });
        
        // 2. Clear input ngay lập tức để gửi tin tiếp theo được luôn
        input.value = '';
        renderMessages(activeConvId, false);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(localMessages));

        // 3. Phản hồi AI sau 1 giây
        if (activeConvId === AI_BOT_ID) {
            setTimeout(() => {
                const reply = getBotReply(content);
                localMessages.push({ id: 'ai-' + Date.now(), conversationId: AI_BOT_ID, sender: 'customer', content: reply, time: nowStr() });
                renderMessages(AI_BOT_ID, false);
                localStorage.setItem(HISTORY_KEY, JSON.stringify(localMessages));
            }, 1000);
        }
    };

})();
