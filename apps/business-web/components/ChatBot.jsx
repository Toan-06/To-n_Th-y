import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * ChatBot Component — Hệ thống AI Thông minh v5.1
 * Senior Frontend Engineer Implementation
 * Sửa lỗi layout bị đẩy ra ngoài viewport và tối ưu cuộn trang
 */
const ChatBot = ({ mode = 'floating' }) => {
  const isEmbedded = mode === 'embedded';
  const MEMORY_KEY = 'chatbot_memory_v5';
  const HISTORY_KEY = 'chatbot_history_v5';

  const [isOpen, setIsOpen] = useState(isEmbedded);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [memory, setMemory] = useState({});
  const [session, setSession] = useState({ step: 'idle', data: {} });

  const messagesEndRef = useRef(null);

  useEffect(() => {
    const savedMemory = localStorage.getItem(MEMORY_KEY);
    if (savedMemory) setMemory(JSON.parse(savedMemory));
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    if (savedHistory) {
      setMessages(JSON.parse(savedHistory));
    } else {
      setMessages([
        { id: 1, role: 'bot', text: 'Chào bạn! Em là trợ lý tư vấn dịch vụ. Em có thể hỗ trợ bạn đặt phòng hoặc tìm các tour du lịch hấp dẫn. Bạn muốn tìm hiểu gì ạ?', time: nowStr() }
      ]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  }, [messages, memory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 150);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  const normalize = (text) => {
    if (!text) return "";
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').trim();
  };

  const getBotReply = useCallback((userMessage) => {
    const raw = userMessage;
    const clean = normalize(raw);
    
    if (raw.toLowerCase().startsWith('day:')) {
      const parts = raw.substring(4).split('=');
      if (parts.length === 2) {
        const k = normalize(parts[0]);
        const v = parts[1].trim();
        setMemory(prev => ({ ...prev, [k]: v }));
        return `Đã nhớ! Từ giờ khi nói về '${k}', em sẽ đáp: '${v}'`;
      }
    }

    for (let k in memory) {
      if (clean.includes(k)) return memory[k];
    }

    if (session.step === 'asking_people') {
      const num = raw.match(/\d+/);
      if (num) {
        setSession(prev => ({ ...prev, step: 'asking_date', data: { ...prev.data, people: num[0] } }));
        return `Dạ, em ghi nhận ${num[0]} người ạ. Vậy mình dự định khởi hành ngày nào để em kiểm tra dịch vụ ạ?`;
      }
      return "Dạ mình đi mấy người để em báo giá và kiểm tra chỗ trống ạ?";
    }

    if (session.step === 'asking_date') {
      setSession(prev => ({ ...prev, step: 'asking_phone', data: { ...prev.data, date: raw } }));
      return `Ngày ${raw} bên em vẫn còn dịch vụ ạ. Cho em xin số điện thoại để em giữ chỗ cho mình nhé!`;
    }

    if (session.step === 'asking_phone') {
      const phone = raw.match(/\d{9,11}/);
      if (phone) {
        setSession({ step: 'idle', data: {} });
        return `Tuyệt vời! Em đã nhận số ${phone[0]}. Chuyên viên sẽ gọi lại tư vấn cho mình trong ít phút nữa ạ. 😊`;
      }
      return "Dạ bạn cho em xin số điện thoại để em xác nhận yêu cầu của mình nhé.";
    }

    if (clean.includes("dich vu") || clean.includes("co gi")) {
      return "Dạ bên em cung cấp trọn gói các dịch vụ: \n1. **Đặt phòng Resort/Khách sạn** cao cấp giá ưu đãi. \n2. **Tour du lịch trọn gói** (Hạ Long, Đà Nẵng, Hội An). \nBạn muốn tìm hiểu thêm về dịch vụ nào ạ?";
    }

    if (clean.includes("tour") || clean.includes("di choi")) {
      setSession({ step: 'asking_people', data: {} });
      return "Dạ em hỗ trợ đặt tour ạ. Mình dự định đi đoàn mấy người để em báo giá tốt nhất?";
    }

    if (clean.includes("phong") || clean.includes("dat")) {
      setSession({ step: 'asking_people', data: {} });
      return "Dạ em hỗ trợ đặt phòng ạ. Mình đi mấy người để em kiểm tra các hạng phòng trống ạ?";
    }

    if (clean.includes("gia") || clean.includes("bao nhieu")) {
      return "Dạ giá bên em rất linh hoạt: Tour từ 1.8tr/người và Phòng từ 1.2tr/đêm. Bạn muốn em gửi bảng giá chi tiết của dịch vụ nào ạ?";
    }

    return "Dạ em chưa hiểu rõ ý mình lắm. Bạn muốn xem **dịch vụ**, **đặt phòng** hay hỏi về **giá cả** ạ?";
  }, [memory, session]);

  const handleSend = useCallback((text) => {
    const content = (typeof text === 'string' ? text : input).trim();
    if (!content) return;

    // 1. Thêm tin nhắn của User ngay lập tức
    const userMsg = { id: Date.now(), role: 'user', text: content, time: nowStr() };
    setMessages(prev => [...prev, userMsg]);
    
    // 2. Reset input và trạng thái gõ
    setInput("");
    setIsTyping(true);

    // 3. Bot phản hồi sau đúng 1 giây
    setTimeout(() => {
      const reply = getBotReply(content);
      const botMsg = { id: Date.now() + 1, role: 'bot', text: reply, time: nowStr() };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 1000);
  }, [input, getBotReply]);

  function nowStr() { return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }

  return (
    <div className="chatbot-container" style={isEmbedded ? styles.embeddedContainer : styles.container}>
      {!isEmbedded && !isOpen && (
        <button onClick={() => setIsOpen(true)} style={styles.floatingBtn}>
          <span style={{ fontSize: '28px' }}>🤖</span>
          <div style={styles.badge}>V5.1</div>
        </button>
      )}

      {isOpen && (
        <div style={{...styles.panel, ...(isEmbedded ? styles.embeddedPanel : {})}}>
          <div style={styles.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={styles.avatarBot}>👩‍💼</div>
              <div>
                <div style={styles.headerTitle}>Trợ lý Tư vấn Chuyên nghiệp</div>
                <div style={styles.headerStatus}>Phản hồi ngay tức thì ⚡</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                onClick={() => {
                  setMessages([{ id: 1, role: 'bot', text: 'Chào bạn! Em đã sẵn sàng hỗ trợ lại từ đầu. Bạn muốn tìm hiểu về tour hay khách sạn ạ?', time: nowStr() }]);
                  setSession({ step: 'idle', data: {} });
                }}
                style={styles.resetBtn}
              >
                Reset
              </button>
              {!isEmbedded && <button onClick={() => setIsOpen(false)} style={styles.closeBtn}>✕</button>}
            </div>
          </div>

          <div style={styles.messageArea}>
            {messages.map((msg) => (
              <div key={msg.id} style={{ ...styles.msgWrapper, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ ...styles.bubble, ...(msg.role === 'user' ? styles.userBubble : styles.botBubble) }}>
                  <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
                  <div style={{ ...styles.msgTime, color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : '#94a3b8' }}>{msg.time}</div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={styles.typingIndicator}>
                <div style={styles.dot}></div><div style={styles.dot}></div><div style={styles.dot}></div>
              </div>
            )}
            <div ref={messagesEndRef} style={{ height: '60px', width: '100%', flexShrink: 0 }} />
          </div>

          <div style={styles.inputArea}>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Nhập yêu cầu của bạn..." 
              style={styles.input}
            />
            <button onClick={() => handleSend()} style={styles.sendBtn}>➤</button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { position: 'fixed', bottom: '30px', right: '30px', zIndex: 10000, fontFamily: '"Plus Jakarta Sans", sans-serif' },
  embeddedContainer: { width: '100%', height: 'calc(100vh - 260px)', fontFamily: '"Plus Jakarta Sans", sans-serif', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  floatingBtn: { width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#4f46e5', border: 'none', color: '#fff', cursor: 'pointer', boxShadow: '0 12px 40px rgba(79, 70, 229, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  badge: { position: 'absolute', top: '-5px', right: '-5px', backgroundColor: '#10b981', color: '#fff', fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '10px', border: '2px solid #fff' },
  panel: { width: '420px', height: '620px', backgroundColor: '#fff', borderRadius: '32px', boxShadow: '0 30px 100px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #f1f5f9' },
  embeddedPanel: { width: '100%', height: '100%', borderRadius: '0', border: 'none', boxShadow: 'none' },
  header: { padding: '20px 24px', background: 'linear-gradient(135deg, #1e1b4b, #4338ca)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
  avatarBot: { width: '44px', height: '44px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' },
  headerTitle: { fontSize: '15px', fontWeight: '800' },
  headerStatus: { fontSize: '11px', opacity: 0.8, marginTop: '2px' },
  resetBtn: { backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer' },
  messageArea: { flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: '#fcfcfd', display: 'flex', flexDirection: 'column', gap: '16px' },
  msgWrapper: { display: 'flex', width: '100%' },
  bubble: { maxWidth: '82%', padding: '14px 20px', borderRadius: '24px', fontSize: '15px', lineHeight: '1.6' },
  botBubble: { backgroundColor: '#fff', color: '#1e293b', borderBottomLeftRadius: '4px', border: '1px solid #f1f5f9' },
  userBubble: { backgroundColor: '#4338ca', color: '#fff', borderBottomRightRadius: '4px' },
  msgTime: { fontSize: '10px', marginTop: '6px', textAlign: 'right' },
  typingIndicator: { display: 'flex', gap: '5px', padding: '12px 20px', backgroundColor: '#fff', borderRadius: '20px', alignSelf: 'flex-start', border: '1px solid #f1f5f9' },
  dot: { width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#cbd5e1', animation: 'typingDot 1.4s infinite ease-in-out' },
  inputArea: { padding: '20px 24px 30px', backgroundColor: '#fff', display: 'flex', gap: '12px', alignItems: 'center', borderTop: '1px solid #f1f5f9', flexShrink: 0 },
  input: { flex: 1, padding: '15px 22px', borderRadius: '18px', border: '2.5px solid #f1f5f9', outline: 'none', fontSize: '15.5px' },
  sendBtn: { width: '54px', height: '54px', borderRadius: '16px', backgroundColor: '#4338ca', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
};

export default ChatBot;
