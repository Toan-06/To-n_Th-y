// ============================================================
// HomePage.jsx — Business Dashboard Home Page
// Dùng data giả (mock data), không cần backend
// Dễ nâng cấp lên API sau bằng cách thay data trong hooks
// ============================================================

// ── Mock Data ────────────────────────────────────────────────
const activities = [
  { id: 1, icon: "📅", text: "Nguyễn Văn A đã đặt Tour Hạ Long",      time: "2 phút trước" },
  { id: 2, icon: "💬", text: "Bạn có 2 tin nhắn mới",                  time: "15 phút trước" },
  { id: 3, icon: "⭐", text: "Có 3 đánh giá mới từ khách hàng",        time: "1 giờ trước" },
  { id: 4, icon: "📅", text: "Trần Thị B đã đặt Khách sạn Đà Nẵng",   time: "2 giờ trước" },
  { id: 5, icon: "✅", text: "Đơn hàng #1042 đã được xác nhận",        time: "3 giờ trước" },
];

const services = [
  { id: 1, name: "Tour Hạ Long",       price: 1800000, unit: "người", status: "active",  bookings: 124, rating: 4.8, image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80" },
  { id: 2, name: "Khách sạn Đà Nẵng", price: 1200000, unit: "đêm",   status: "active",  bookings: 87,  rating: 4.5, image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=80" },
  { id: 3, name: "Tour Sapa 3N2Đ",    price: 3200000, unit: "người", status: "pending", bookings: 0,   rating: 0,   image: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80" },
];

const messages = [
  { id: 1, user: "Nguyễn Văn A", avatar: "N", text: "Cho mình hỏi giá tour Hạ Long 2 người?",          time: "5 phút trước",  unread: true  },
  { id: 2, user: "Trần Thị B",   avatar: "T", text: "Còn phòng không ạ? Mình muốn đặt cuối tuần này.", time: "30 phút trước", unread: true  },
  { id: 3, user: "Lê Minh C",    avatar: "L", text: "Tour có bao gồm bữa ăn không?",                   time: "2 giờ trước",   unread: false },
];

const reviews = [
  { id: 1, user: "Nguyễn Văn C", avatar: "N", rating: 5, comment: "Dịch vụ rất tốt, hướng dẫn viên nhiệt tình, sẽ ủng hộ lần sau!", service: "Tour Hạ Long",       time: "1 ngày trước" },
  { id: 2, user: "Phạm Thu D",   avatar: "P", rating: 4, comment: "Khách sạn sạch sẽ, vị trí đẹp, nhân viên thân thiện.",           service: "Khách sạn Đà Nẵng", time: "2 ngày trước" },
  { id: 3, user: "Hoàng Văn E",  avatar: "H", rating: 5, comment: "Tuyệt vời! Phong cảnh đẹp, tổ chức chuyên nghiệp.",              service: "Tour Hạ Long",       time: "3 ngày trước" },
];

// ── Utils ────────────────────────────────────────────────────
function formatPrice(price) {
  if (!price && price !== 0) return "Liên hệ";
  return new Intl.NumberFormat("vi-VN").format(price) + " VND";
}

function renderStars(rating) {
  const full = Math.round(rating);
  return "⭐".repeat(Math.min(full, 5));
}

// ── Components ───────────────────────────────────────────────

/** Danh sách hoạt động gần đây */
function ActivityList({ items }) {
  return (
    <section style={styles.section}>
      <h3 style={styles.sectionTitle}>🕐 Hoạt động gần đây</h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((act) => (
          <li key={act.id} style={styles.activityItem}>
            <span style={styles.activityIcon}>{act.icon}</span>
            <div style={{ flex: 1 }}>
              <span style={styles.activityText}>{act.text}</span>
              <div style={styles.activityTime}>{act.time}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Card một dịch vụ */
function ServiceCard({ svc }) {
  const statusConfig = {
    active:  { label: "Đang hoạt động", color: "#059669", bg: "#ecfdf5" },
    pending: { label: "Chờ duyệt",      color: "#d97706", bg: "#fffbeb" },
    paused:  { label: "Tạm dừng",       color: "#475569", bg: "#f1f5f9" },
  };
  const sc = statusConfig[svc.status] || statusConfig.paused;

  return (
    <div style={styles.serviceCard}>
      <img
        src={svc.image}
        alt={svc.name}
        style={styles.serviceCardImg}
        onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80"; }}
      />
      <div style={styles.serviceCardBody}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <h4 style={styles.serviceCardTitle}>{svc.name}</h4>
          <span style={{ ...styles.badge, background: sc.bg, color: sc.color }}>{sc.label}</span>
        </div>
        <div style={styles.serviceCardPrice}>
          {formatPrice(svc.price)}
          {svc.unit && <span style={styles.serviceCardUnit}> / {svc.unit}</span>}
        </div>
        <div style={styles.serviceCardMeta}>
          <span>{svc.rating > 0 ? `⭐ ${svc.rating}` : "⭐ Chưa có"}</span>
          <span>🔥 {svc.bookings} lượt đặt</span>
        </div>
      </div>
    </div>
  );
}

/** Danh sách dịch vụ */
function ServiceList({ items }) {
  return (
    <section style={styles.section}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ ...styles.sectionTitle, marginBottom: 0 }}>🧳 Dịch vụ của bạn</h3>
        <span style={styles.linkBtn}>Xem tất cả →</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((svc) => (
          <ServiceCard key={svc.id} svc={svc} />
        ))}
      </div>
    </section>
  );
}

/** Danh sách tin nhắn */
function MessageList({ items }) {
  const unreadCount = items.filter((m) => m.unread).length;
  return (
    <section style={styles.section}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ ...styles.sectionTitle, marginBottom: 0 }}>
          💬 Tin nhắn
          {unreadCount > 0 && (
            <span style={styles.unreadBadge}>{unreadCount}</span>
          )}
        </h3>
        <span style={styles.linkBtn}>Xem tất cả →</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((msg) => (
          <div key={msg.id} style={{ ...styles.messageItem, background: msg.unread ? "#f0f9ff" : "#f8fafc", borderLeft: msg.unread ? "3px solid #6366f1" : "3px solid transparent" }}>
            <div style={styles.msgAvatar}>{msg.avatar}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={styles.msgUser}>{msg.user}</span>
                <span style={styles.msgTime}>{msg.time}</span>
              </div>
              <p style={styles.msgText}>{msg.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Danh sách đánh giá */
function ReviewList({ items }) {
  return (
    <section style={styles.section}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ ...styles.sectionTitle, marginBottom: 0 }}>⭐ Đánh giá mới</h3>
        <span style={styles.linkBtn}>Xem tất cả →</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((rv) => (
          <div key={rv.id} style={styles.reviewCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={styles.reviewAvatar}>{rv.avatar}</div>
              <div style={{ flex: 1 }}>
                <div style={styles.reviewUser}>{rv.user}</div>
                <div style={styles.reviewService}>{rv.service}</div>
              </div>
              <span style={styles.reviewTime}>{rv.time}</span>
            </div>
            <div style={styles.reviewStars}>{renderStars(rv.rating)}</div>
            <p style={styles.reviewComment}>"{rv.comment}"</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** KPI Card nhỏ ở đầu trang */
function KpiCard({ icon, label, value, color }) {
  return (
    <div style={{ ...styles.kpiCard, borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color }}>{value}</div>
      <div style={styles.kpiLabel}>{label}</div>
    </div>
  );
}

// ── Main HomePage Component ───────────────────────────────────
function HomePage() {
  // Dữ liệu KPI tính từ mock data
  const kpis = [
    { icon: "💰", label: "Doanh thu hôm nay",  value: "4.2M ₫",     color: "#10b981" },
    { icon: "📅", label: "Đơn hôm nay",        value: "12",          color: "#6366f1" },
    { icon: "💬", label: "Tin nhắn chưa đọc",  value: String(messages.filter(m => m.unread).length), color: "#f59e0b" },
    { icon: "⭐", label: "Rating trung bình",  value: "4.7",         color: "#ef4444" },
  ];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>🏠 Trang chủ</h1>
          <p style={styles.pageSubtitle}>Chào mừng trở lại! Đây là tổng quan hoạt động hôm nay.</p>
        </div>
        <div style={styles.dateChip}>{new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
      </div>

      {/* KPI Row */}
      <div style={styles.kpiRow}>
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {/* 2-Column Layout */}
      <div style={styles.layout}>
        {/* Cột trái */}
        <div style={styles.colLeft}>
          <ActivityList items={activities} />
          <ServiceList items={services} />
        </div>

        {/* Cột phải */}
        <div style={styles.colRight}>
          <MessageList items={messages} />
          <ReviewList items={reviews} />
        </div>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────
const styles = {
  page: { padding: "0 0 40px" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 },
  pageTitle: { fontSize: 28, fontWeight: 900, color: "#0f172a", margin: 0, marginBottom: 4 },
  pageSubtitle: { fontSize: 15, color: "#64748b", margin: 0 },
  dateChip: { background: "#f1f5f9", padding: "8px 16px", borderRadius: 10, fontSize: 13, color: "#475569", fontWeight: 600 },

  kpiRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 24 },
  kpiCard: { background: "#fff", padding: "20px 16px", borderRadius: 16, boxShadow: "0 4px 15px rgba(0,0,0,0.04)", textAlign: "center" },
  kpiLabel: { fontSize: 12, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 4 },

  layout: { display: "flex", gap: 20, alignItems: "flex-start" },
  colLeft: { flex: 2, display: "flex", flexDirection: "column", gap: 20, minWidth: 0 },
  colRight: { flex: 1, display: "flex", flexDirection: "column", gap: 20, minWidth: 0 },

  section: { background: "#fff", padding: 20, borderRadius: 16, boxShadow: "0 4px 15px rgba(0,0,0,0.04)", border: "1px solid #f1f5f9" },
  sectionTitle: { fontSize: 16, fontWeight: 800, color: "#1e293b", margin: "0 0 16px" },
  linkBtn: { fontSize: 13, color: "#6366f1", fontWeight: 700, cursor: "pointer" },

  activityItem: { display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: "1px solid #f8fafc" },
  activityIcon: { fontSize: 20, flexShrink: 0, marginTop: 2 },
  activityText: { fontSize: 14, color: "#334155", fontWeight: 600 },
  activityTime: { fontSize: 12, color: "#94a3b8", marginTop: 3, fontWeight: 500 },

  serviceCard: { display: "flex", gap: 14, padding: 14, borderRadius: 12, border: "1px solid #f1f5f9", background: "#fafafa", transition: "all 0.2s" },
  serviceCardImg: { width: 80, height: 70, objectFit: "cover", borderRadius: 10, flexShrink: 0 },
  serviceCardBody: { flex: 1, minWidth: 0 },
  serviceCardTitle: { fontSize: 14, fontWeight: 800, color: "#0f172a", margin: "0 0 6px", lineHeight: 1.3 },
  serviceCardPrice: { fontSize: 16, fontWeight: 900, color: "#10b981", marginBottom: 6 },
  serviceCardUnit: { fontSize: 12, color: "#64748b", fontWeight: 600 },
  serviceCardMeta: { display: "flex", gap: 14, fontSize: 12, color: "#64748b", fontWeight: 600 },
  badge: { padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, flexShrink: 0 },

  unreadBadge: { background: "#6366f1", color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, marginLeft: 8 },
  messageItem: { display: "flex", gap: 10, padding: 12, borderRadius: 12, alignItems: "flex-start" },
  msgAvatar: { width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 },
  msgUser: { fontSize: 13, fontWeight: 800, color: "#1e293b" },
  msgTime: { fontSize: 11, color: "#94a3b8" },
  msgText: { fontSize: 13, color: "#475569", margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  reviewCard: { padding: 14, borderRadius: 12, background: "#fafafa", border: "1px solid #f1f5f9" },
  reviewAvatar: { width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#f59e0b,#ef4444)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 },
  reviewUser: { fontSize: 13, fontWeight: 800, color: "#1e293b" },
  reviewService: { fontSize: 11, color: "#6366f1", fontWeight: 600 },
  reviewTime: { fontSize: 11, color: "#94a3b8" },
  reviewStars: { fontSize: 14, marginBottom: 6 },
  reviewComment: { fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.5, fontStyle: "italic" },
};

// Export cho module systems hoặc dùng global
if (typeof module !== "undefined" && module.exports) {
  module.exports = { HomePage, ActivityList, ServiceCard, ServiceList, MessageList, ReviewList };
} else {
  window.HomePage = HomePage;
  window.ActivityList = ActivityList;
  window.ServiceCard = ServiceCard;
  window.ServiceList = ServiceList;
  window.MessageList = MessageList;
  window.ReviewList = ReviewList;
}
