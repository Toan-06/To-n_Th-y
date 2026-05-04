/**
 * chatBox.js — Chăm sóc khách hàng (Floating Widget)
 * Dùng localStorage để lưu messages từng dịch vụ
 * API: window.ChatBox.open(serviceId, serviceName)
 */
(function () {
    'use strict';

    const LS_PREFIX = 'chat_svc_';

    // ── Persist messages ─────────────────────────────────────────
    function loadMessages(serviceId) {
        try { return JSON.parse(localStorage.getItem(LS_PREFIX + serviceId)) || []; }
        catch { return []; }
    }

    function saveMessages(serviceId, msgs) {
        localStorage.setItem(LS_PREFIX + serviceId, JSON.stringify(msgs));
    }

    // ── Current state ────────────────────────────────────────────
    let _serviceId   = null;
    let _serviceName = '';
    let _messages    = [];

    // ── CSS ──────────────────────────────────────────────────────
    const css = `
    /* Overlay backdrop */
    #cb-backdrop {
        display: none;
        position: fixed; inset: 0;
        background: rgba(15, 23, 42, 0.2);
        backdrop-filter: blur(8px);
        z-index: 10000;
        animation: cbFadeIn .3s ease;
    }
    #cb-backdrop.open { display: block; }

    /* Chat panel */
    #cb-panel {
        display: none;
        position: fixed;
        bottom: 24px; right: 24px;
        width: 400px;
        max-height: 600px;
        background: #fff;
        border-radius: 24px;
        box-shadow: 0 20px 50px rgba(0,0,0,.15), 0 0 0 1px rgba(0,0,0,.05);
        z-index: 10001;
        flex-direction: column;
        overflow: hidden;
        animation: cbSlideUp .4s cubic-bezier(.16, 1, .3, 1);
        border: 1px solid #f1f5f9;
    }
    #cb-panel.open { display: flex; }

    @keyframes cbFadeIn  { from { opacity:0 } to { opacity:1 } }
    @keyframes cbSlideUp { from { opacity:0; transform:translateY(60px) scale(.9) } to { opacity:1; transform:none } }

    /* Header */
    #cb-header {
        display: flex; align-items: center; gap: 14px;
        padding: 20px 24px;
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        flex-shrink: 0;
        position: relative;
    }
    #cb-header::after {
        content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
        background: rgba(255,255,255,0.1);
    }
    #cb-avatar-wrap { position: relative; flex-shrink: 0; }
    #cb-avatar {
        width: 44px; height: 44px; border-radius: 14px;
        background: rgba(255,255,255,.2);
        display: flex; align-items: center; justify-content: center;
        font-size: 22px; color: #fff;
    }
    .cb-online-dot {
        position: absolute; bottom: -2px; right: -2px;
        width: 12px; height: 12px; border-radius: 50%;
        background: #10b981; border: 2px solid #6366f1;
    }
    #cb-title {
        flex: 1; min-width: 0;
        font-size: 15px; font-weight: 800;
        color: #fff;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    #cb-subtitle {
        font-size: 12px; color: rgba(255,255,255,.8);
        font-weight: 500; margin-top: 2px;
        display: flex; align-items: center; gap: 4px;
    }
    #cb-close {
        width: 32px; height: 32px; border-radius: 10px;
        background: rgba(255,255,255,.15);
        border: none; color: #fff; font-size: 16px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: all .2s; flex-shrink: 0;
    }
    #cb-close:hover { background: rgba(255,255,255,.25); transform: rotate(90deg); }

    /* Messages list */
    #cb-messages {
        flex: 1; overflow-y: auto;
        padding: 24px;
        display: flex; flex-direction: column; gap: 14px;
        background: #fff;
        min-height: 0;
        scroll-behavior: smooth;
    }
    #cb-messages::-webkit-scrollbar { width: 5px; }
    #cb-messages::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }

    /* Individual message bubbles */
    .cb-msg { display: flex; align-items: flex-end; gap: 10px; max-width: 85%; }
    .cb-msg.received { align-self: flex-start; }
    .cb-msg.sent { align-self: flex-end; flex-direction: row-reverse; max-width: 85%; }

    .cb-msg-av {
        width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; font-weight: 800; color: #fff;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .cb-bubble {
        padding: 12px 16px;
        border-radius: 20px;
        font-size: 14.5px; line-height: 1.5;
        word-break: break-word;
        box-shadow: 0 1px 2px rgba(0,0,0,.05);
    }
    .cb-msg.received .cb-bubble {
        background: #f1f5f9;
        color: #1e293b;
        border-bottom-left-radius: 4px;
    }
    .cb-msg.sent .cb-bubble {
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        color: #fff;
        border-bottom-right-radius: 4px;
    }
    .cb-time {
        font-size: 11px; color: #94a3b8;
        margin-top: 5px; display: block;
        font-weight: 500;
    }
    .cb-msg.sent .cb-time { text-align: right; }

    /* System message */
    .cb-system {
        text-align: center;
        font-size: 12px; color: #94a3b8;
        padding: 8px 0; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.5px;
    }

    /* Empty state */
    .cb-empty {
        flex: 1; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        text-align: center; padding: 60px 24px;
        color: #cbd5e1;
    }
    .cb-empty-icon { font-size: 56px; margin-bottom: 16px; opacity: 0.5; }
    .cb-empty-text { font-size: 15px; font-weight: 700; color: #64748b; }

    /* Input area */
    #cb-input-area {
        padding: 16px 24px 24px;
        border-top: 1px solid #f1f5f9;
        display: flex; gap: 12px; align-items: flex-end;
        background: #fff; flex-shrink: 0;
    }
    #cb-input {
        flex: 1;
        border: 2.5px solid #f1f5f9;
        border-radius: 16px;
        padding: 12px 16px;
        font-size: 14px; resize: none;
        outline: none; font-family: inherit;
        max-height: 120px; min-height: 48px;
        line-height: 1.5;
        transition: all .2s;
        background: #f8fafc;
        color: #1e293b;
    }
    #cb-input:focus { border-color: #4f46e5; background: #fff; box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1); }
    #cb-send {
        width: 48px; height: 48px; border-radius: 16px;
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        border: none; color: #fff; font-size: 20px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: all .3s cubic-bezier(.34,1.56,.64,1); flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
    }
    #cb-send:hover { transform: scale(1.05) translateY(-2px); box-shadow: 0 8px 16px rgba(79, 70, 229, 0.35); }
    #cb-send:active { transform: scale(.95); }

    /* Quick replies */
    #cb-quick-replies {
        display: flex; gap: 8px; flex-wrap: wrap;
        padding: 8px 24px 0; background: #fff;
    }
    .cb-quick {
        padding: 8px 14px; border-radius: 20px;
        border: 1.5px solid #e2e8f0;
        background: #fff;
        font-size: 13px; font-weight: 700; color: #475569;
        cursor: pointer; transition: all .2s; white-space: nowrap;
    }
    .cb-quick:hover { border-color: #4f46e5; color: #4f46e5; background: #f5f3ff; transform: translateY(-1px); }

    /* Typing indicator */
    #cb-typing {
        display: none;
        padding: 0 24px 12px;
        background: #fff;
    }
    .cb-typing-dots {
        display: inline-flex; gap: 5px; align-items: center;
        background: #f1f5f9; padding: 10px 16px; border-radius: 18px;
        border-bottom-left-radius: 4px;
    }
    .cb-dot {
        width: 6px; height: 6px; border-radius: 50%; background: #94a3b8;
        animation: cbDotBounce 1.4s infinite ease-in-out;
    }
    .cb-dot:nth-child(2) { animation-delay: .2s; }
    .cb-dot:nth-child(3) { animation-delay: .4s; }
    @keyframes cbDotBounce {
        0%, 80%, 100% { transform: scale(.6); opacity:.4 }
        40% { transform: scale(1); opacity:1 }
    }
    `;

    // ── HTML template ────────────────────────────────────────────
    function buildPanel() {
        const el = document.createElement('div');
        el.innerHTML = `
        <div id="cb-backdrop"></div>
        <div id="cb-panel" role="dialog" aria-modal="true" aria-label="Chăm sóc khách hàng">
            <div id="cb-header">
                <div id="cb-avatar-wrap">
                    <div id="cb-avatar">💬</div>
                    <div class="cb-online-dot"></div>
                </div>
                <div style="flex:1;min-width:0">
                    <div id="cb-title">Chăm sóc khách hàng</div>
                    <div id="cb-subtitle">Phản hồi nhanh trong vài giây ⚡</div>
                </div>
                <button id="cb-close" aria-label="Đóng">✕</button>
            </div>
            <div id="cb-messages"></div>
            <div id="cb-typing">
                <div class="cb-typing-dots">
                    <div class="cb-dot"></div>
                    <div class="cb-dot"></div>
                    <div class="cb-dot"></div>
                </div>
            </div>
            <div id="cb-quick-replies"></div>
            <div id="cb-input-area">
                <textarea id="cb-input" rows="1" placeholder="Nhập câu hỏi của bạn..."></textarea>
                <button id="cb-send" aria-label="Gửi">➤</button>
            </div>
        </div>`;
        document.body.appendChild(el.children[0]); // backdrop
        document.body.appendChild(el.children[0]); // panel
    }

    // ── Render messages list ─────────────────────────────────────
    function renderMessages() {
        const container = document.getElementById('cb-messages');
        if (!container) return;

        if (_messages.length === 0) {
            container.innerHTML = `
            <div class="cb-empty">
                <div class="cb-empty-icon">💬</div>
                <div class="cb-empty-text">Trung tâm hỗ trợ khách hàng<br><span style="font-weight:400;font-size:13px;margin-top:8px;display:block">Chào mừng! Chúng tôi có thể giúp gì cho bạn?</span></div>
            </div>`;
            return;
        }

        container.innerHTML = _messages.map(m => {
            if (m.system) return `<div class="cb-system">${m.text}</div>`;

            const isSent = m.role === 'user';
            const avatarColor = isSent ? '#4f46e5' : '#10b981';
            const avatarChar  = isSent ? 'B' : 'K';

            return `
            <div class="cb-msg ${isSent ? 'sent' : 'received'}">
                <div class="cb-msg-av" style="background:${avatarColor}">${avatarChar}</div>
                <div style="display:flex;flex-direction:column;${isSent ? 'align-items:flex-end' : ''}">
                    <div class="cb-bubble">${m.text}</div>
                    <span class="cb-time">${m.time}</span>
                </div>
            </div>`;
        }).join('');

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    // ── Quick replies per context ────────────────────────────────
    function renderQuickReplies() {
        const el = document.getElementById('cb-quick-replies');
        if (!el) return;
        const replies = [
            'Cho tôi hỏi về giá?',
            'Còn chỗ không?',
            'Có ưu đãi gì không?',
            'Hướng dẫn đặt chỗ',
        ];
        el.innerHTML = _messages.length === 0
            ? replies.map(r => `<button class="cb-quick" onclick="window.ChatBox.quickReply('${r}')">${r}</button>`).join('')
            : '';
    }

    // ── Now time string ──────────────────────────────────────────
    function nowStr() {
        return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    // ── Auto business reply (simulated) ─────────────────────────
    const autoReplies = [
        'Xin chào! Bạn đang quan tâm đến dịch vụ này đúng không ạ? 😊',
        'Dạ vâng! Hệ thống của chúng tôi hiện vẫn còn chỗ cho ngày bạn chọn.',
        'Bạn có thể để lại số điện thoại để nhân viên tư vấn gọi lại trực tiếp không ạ?',
        'Dịch vụ này đang có chương trình giảm giá 10% nếu đặt trong hôm nay đấy ạ! ✨',
        'Dạ, bên em đã nhận được yêu cầu. Đội ngũ CSKH sẽ phản hồi chi tiết cho bạn ngay!',
    ];
    let _autoReplyIdx = 0;

    function simulateReply() {
        // Show typing
        const typing = document.getElementById('cb-typing');
        if (typing) typing.style.display = 'block';

        const msgList = document.getElementById('cb-messages');
        if (msgList) msgList.scrollTop = msgList.scrollHeight;

        setTimeout(() => {
            if (typing) typing.style.display = 'none';

            const reply = autoReplies[_autoReplyIdx % autoReplies.length];
            _autoReplyIdx++;

            _messages.push({ role: 'biz', text: reply, time: nowStr() });
            saveMessages(_serviceId, _messages);
            renderMessages();
            renderQuickReplies();
        }, 1200 + Math.random() * 800);
    }

    // ── Send message ─────────────────────────────────────────────
    function sendMessage(text) {
        const content = (text || '').trim();
        if (!content) return;

        _messages = [..._messages, { role: 'user', text: content, time: nowStr() }];
        saveMessages(_serviceId, _messages);

        // Clear input
        const input = document.getElementById('cb-input');
        if (input) { input.value = ''; input.style.height = 'auto'; }

        renderMessages();
        renderQuickReplies();

        // Simulate business reply
        simulateReply();
    }

    // ── Public API ───────────────────────────────────────────────
    window.ChatBox = {

        open(serviceId, serviceName) {
            _serviceId   = String(serviceId);
            _serviceName = serviceName || 'Dịch vụ';
            _messages    = loadMessages(_serviceId);

            const title = document.getElementById('cb-title');
            if (title) title.textContent = 'Hỗ trợ: ' + _serviceName;

            document.getElementById('cb-backdrop').classList.add('open');
            document.getElementById('cb-panel').classList.add('open');

            renderMessages();
            renderQuickReplies();

            // Focus input
            setTimeout(() => {
                const inp = document.getElementById('cb-input');
                if (inp) inp.focus();
            }, 400);
        },

        close() {
            document.getElementById('cb-backdrop').classList.remove('open');
            document.getElementById('cb-panel').classList.remove('open');
        },

        quickReply(text) {
            sendMessage(text);
        },

        send() {
            const input = document.getElementById('cb-input');
            sendMessage(input ? input.value : '');
        }
    };

    // ── Init on DOMContentLoaded ─────────────────────────────────
    function init() {
        if (!document.getElementById('cb-style')) {
            const st = document.createElement('style');
            st.id = 'cb-style';
            st.textContent = css;
            document.head.appendChild(st);
        }

        buildPanel();

        document.getElementById('cb-close').addEventListener('click', () => window.ChatBox.close());
        document.getElementById('cb-backdrop').addEventListener('click', () => window.ChatBox.close());
        document.getElementById('cb-send').addEventListener('click', () => window.ChatBox.send());

        const input = document.getElementById('cb-input');
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.ChatBox.send();
            }
        });
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
