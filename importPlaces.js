require('dotenv').config();
const mongoose = require('mongoose');
const Place = require('./models/Place');
const Service = require('./server/models/Service');
const User = require('./server/models/User');

const PLACES = [
  {
    id: "phu-quoc", name: "Phú Quốc", region: "Kiên Giang",
    tags: ["biển", "ẩm thực", "nghỉ dưỡng"], budget: 3, pace: "vua",
    habits: ["gia đình", "cặp đôi", "đi sớm"],
    interests: ["biển", "resort", "hải sản", "chụp ảnh"],
    meta: "Biển xanh, hoàng hôn & hải sản tươi",
    text: "Đảo ngọc với resort cao cấp, chợ đêm và làng chài.",
    image: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80",
    lat: 10.2899, lng: 103.984, top: true,
    transportTips: "Bay thẳng Phú Quốc; thuê xe máy hoặc taxi hợp đồng cho tuyến Bắc–Nam đảo.",
    activities: [
      { dayPart: "Sáng", title: "Bãi Sao hoặc Bãi Khem", tip: "Đi sớm tránh nắng gắt; mang dép đi biển." },
      { dayPart: "Chiều", title: "Lặn/snorkel hoặc câu cá", tip: "Đặt tour có hướng dẫn địa phương; kiểm tra thời tiết." },
      { dayPart: "Tối", title: "Chợ đêm Dinh Cậu / làng chài Hàm Ninh", tip: "Hải sản nướng hỏi giá trước; giữ đồ cá nhân ở chợ đông." }
    ]
  },
  {
    id: "hoi-an", name: "Hội An", region: "Quảng Nam",
    tags: ["văn hóa", "ẩm thực"], budget: 2, pace: "cham",
    habits: ["cặp đôi", "đi một mình", "cú đêm"],
    interests: ["phố cổ", "ẩm thực", "làng nghề", "UNESCO"],
    meta: "Phố cổ đèn lồng & di sản UNESCO",
    text: "Đi bộ phố cổ, thử cao lầu và workshop gốm.",
    image: "https://images.unsplash.com/photo-1598970434795-0c54fe7c0648?w=800&q=80",
    lat: 15.8801, lng: 108.338, top: true,
    transportTips: "Bay Đà Nẵng rồi xe buýt/xe máy ~45 phút; phố cổ đi bộ là lý tưởng.",
    activities: [
      { dayPart: "Sáng", title: "Chợ Hội An & hẻm cà phê sắc màu", tip: "Ăn sáng cao lầu, mì Quảng tại quán địa phương." },
      { dayPart: "Chiều", title: "Làng gốm Thanh Hà / rừng dừa Cẩm Thanh", tip: "Thuê xe đạp hoặc xích lô có thỏa thuận giá trước." },
      { dayPart: "Tối", title: "Đèn lồng & bờ sông Hoài", tip: "Sông đông cuối tuần — đặt bàn ăn trước nếu nhóm đông." }
    ]
  },
  {
    id: "sa-pa", name: "Sa Pa", region: "Lào Cai",
    tags: ["leo núi", "văn hóa", "ẩm thực"], budget: 2, pace: "nhanh",
    habits: ["đi một mình", "gia đình", "đi sớm"],
    interests: ["trekking", "bản làng", "ruộng bậc thang", "check-in"],
    meta: "Ruộng bậc thang & bản làng dân tộc",
    text: "Trekking Fansipan, chợ phiên và homestay ấm cúng.",
    image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=800&q=80",
    lat: 22.3364, lng: 103.8438, top: true,
    transportTips: "Tàu Hà Nội–Lào Cai hoặc xe khách; Sa Pa lạnh — mang áo ấm kể cả hè.",
    activities: [
      { dayPart: "Sáng", title: "Trekking bản Cát Cát / Tả Van", tip: "Thuê porter nếu mang nhiều đồ; giày leo núi chống trơn." },
      { dayPart: "Chiều", title: "Fansipan (cáp treo) hoặc thác Bạc", tip: "Mua vé online giờ cao điểm; kiểm tra sương mù." },
      { dayPart: "Tối", title: "Chợ tối & thử lẩu cá suối", tip: "Homestay thường có bữa tối chung — báo trước dị ứng món ăn." }
    ]
  },
  {
    id: "ha-long", name: "Vịnh Hạ Long", region: "Quảng Ninh",
    tags: ["biển", "văn hóa", "nghỉ dưỡng"], budget: 3, pace: "vua",
    habits: ["cặp đôi", "gia đình"],
    interests: ["du thuyền", "kayak", "UNESCO", "check-in"],
    meta: "Di sản thiên nhiên thế giới",
    text: "Du thuyền ngắm đảo đá vôi, kayak và hang động.",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    lat: 20.9101, lng: 107.1839, top: true,
    transportTips: "Ô tô từ Hà Nội ~2.5–3h; chọn tàu/ghép đoàn có hợp đồng rõ ràng.",
    activities: [
      { dayPart: "Sáng", title: "Lên tàu ngày đêm hoặc tour 1 ngày", tip: "So sánh hành trình: Titop, Sửng Sốt, làng chài." },
      { dayPart: "Chiều", title: "Kayak / chèo sup vịnh", tip: "Mặc áo phao; tránh vị trí xa tàu khi sóng to." },
      { dayPart: "Tối", title: "Câu mực trên tàu (nếu lưu trú đêm)", tip: "Mang áo gió; ẩm trên vịnh." }
    ]
  },
  {
    id: "ha-noi", name: "Hà Nội", region: "Thủ đô",
    tags: ["ẩm thực", "văn hóa"], budget: 1, pace: "cham",
    habits: ["cú đêm", "đi một mình", "cặp đôi"],
    interests: ["phố cổ", "cà phê", "bảo tàng", "ẩm thực đường phố"],
    meta: "36 phố phường & ẩm thực đường phố",
    text: "Phố cổ, hồ Hoàn Kiếm và tour ẩm thực đêm.",
    image: "https://images.unsplash.com/photo-1555921015-5532091f6026?w=800&q=80",
    lat: 21.0285, lng: 105.8542, top: false,
    transportTips: "Grab/ba gác nội thành; tránh giờ cao điểm phố cổ bằng xe máy lần đầu.",
    activities: [
      { dayPart: "Sáng", title: "Hồ Gươm, Bảo tàng Dân tộc", tip: "Phở buổi sáng ở quán đông người địa phương." },
      { dayPart: "Chiều", title: "Phố cổ & Nhà Thờ", tip: "Cà phê trứng Giảng — đi sớm chụp ảnh." },
      { dayPart: "Tối", title: "Bia hơi vỉa hè / chợ đêm", tip: "Giữ túi tiền; uống có trách nhiệm." }
    ]
  },
  {
    id: "da-lat", name: "Đà Lạt", region: "Lâm Đồng",
    tags: ["leo núi", "ẩm thực", "nghỉ dưỡng"], budget: 2, pace: "cham",
    habits: ["cặp đôi", "gia đình"],
    interests: ["Đà Lạt", "sức khỏe", "cà phê", "thiên nhiên"],
    meta: "Thành phố ngàn hoa & khí hậu mát",
    text: "Hồ Tuyền Lâm, đồi chè và cà phê specialty.",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
    lat: 11.9404, lng: 108.4583, top: true,
    transportTips: "Xe khách ghế nằm từ TP.HCM; Đà Lạt dốc — nếu tự lái cần kinh nghiệm.",
    activities: [
      { dayPart: "Sáng", title: "Đồi chè Cầu Đất hoặc Langbiang", tip: "Sương sớm đẹp; mang áo khoác." },
      { dayPart: "Chiều", title: "Hồ Tuyền Lâm, đạp xe / thuyền kayak", tip: "Tránh hẻm xe tay ga lần đầu." },
      { dayPart: "Tối", title: "Chợ đêm Đà Lạt & ăn vặt", tip: "Kem bơ, bánh tráng nướng — hỏi giá trước." }
    ]
  },
  {
    id: "da-nang", name: "Đà Nẵng", region: "Đà Nẵng",
    tags: ["biển", "ẩm thực", "văn hóa"], budget: 2, pace: "vua",
    habits: ["gia đình", "cặp đôi"],
    interests: ["biển", "cầu Vàng", "ẩm thực", "resort"],
    meta: "Biển Mỹ Khê & Bà Nà Hills",
    text: "Tắm biển, cầu Rồng phun lửa cuối tuần, lên Bà Nà.",
    image: "https://images.unsplash.com/photo-1559592413-7cec096d7b88?w=800&q=80",
    lat: 16.0544, lng: 108.2022, top: false,
    transportTips: "Bay thẳng Đà Nẵng hub tốt cho Miền Trung; thuê xe máy bát nháo — kiểm tra kỹ xe.",
    activities: [
      { dayPart: "Sáng", title: "Bãi biển Mỹ Khê / Ngũ Hành Sơn", tip: "Nắng mạnh 10h–14h — che chắn da." },
      { dayPart: "Chiều", title: "Bà Nà Hills (cáp treo)", tip: "Mát hơn trung tâm; mang áo nhẹ." },
      { dayPart: "Tối", title: "Cầu Rồng, chợ Hàn ăn vặt", tip: "Cuối tuần đông; giữ túi ở chợ." }
    ]
  },
  {
    id: "nha-trang", name: "Nha Trang", region: "Khánh Hòa",
    tags: ["biển", "ẩm thực"], budget: 2, pace: "vua",
    habits: ["cặp đôi", "gia đình", "cú đêm"],
    interests: ["lặn", "đảo", "resort", "ẩm thực"],
    meta: "Thành phố biển & đảo nhỏ",
    text: "VinWonders, đảo Hòn Mun, bún sứa & hải sản.",
    image: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800&q=80",
    lat: 12.2388, lng: 109.1967, top: false,
    transportTips: "Bay Cam Ranh, xe bus/shuttle vào trung tâm; tắm biển chú ý cờ an toàn.",
    activities: [
      { dayPart: "Sáng", title: "Tham quan Tháp Bà Ponagar", tip: "Đi sớm; váy ngắn cần sarong." },
      { dayPart: "Chiều", title: "Tour 3–4 đảo hoặc Vinpearl", tip: "So sánh giá nước/kayak trên đảo." },
      { dayPart: "Tối", title: "Chợ đêm / quán hải sản đường biển", tip: "Chọn hải sản tươi sống; hỏi giá/kg." }
    ]
  },
  {
    id: "can-tho", name: "Cần Thơ", region: "Cần Thơ",
    tags: ["văn hóa", "ẩm thực"], budget: 1, pace: "cham",
    habits: ["đi một mình", "gia đình"],
    interests: ["miệt vườn", "chợ nổi", "sông nước", "ẩm thực"],
    meta: "Chợ nổi Cái Răng & miệt vườn",
    text: "Sông Hậu, chợ nổi sáng sớm và bánh cống đường quê.",
    image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=80",
    lat: 10.0452, lng: 105.7469, top: false,
    transportTips: "Từ TP.HCM ~3–4h; chợ nổi 5h30–7h — nghỉ gần bến nếu muốn kịp giờ.",
    activities: [
      { dayPart: "Sáng", title: "Chợ nổi Cái Răng", tip: "Thuê ghe nhỏ có người lái; chuẩn bị tiền mặt lẻ." },
      { dayPart: "Chiều", title: "Bình Thủy cổ miếu / vườn trái cây", tip: "Ăn trái cây đúng mùa — hỏi giá tham quan." },
      { dayPart: "Tối", title: "Bến Ninh Kiều, nhạc sông nước", tip: "Thử lẩu mắm với nhóm đông dễ chia." }
    ]
  },
  {
    id: "ninh-binh", name: "Ninh Bình", region: "Ninh Bình",
    tags: ["leo núi", "văn hóa"], budget: 1, pace: "cham",
    habits: ["gia đình", "cặp đôi", "đi một mình"],
    interests: ["trekking", "hang động", "UNESCO", "chùa"],
    meta: "Tràng An & Hang Múa huyền bí",
    text: "Chèo thuyền Tràng An, leo Hang Múa ngắm toàn cảnh.",
    image: "https://images.unsplash.com/photo-1570739619121-88fb75e67b7d?w=800&q=80",
    lat: 20.2506, lng: 105.9745, top: true,
    transportTips: "Ô tô/xe máy từ Hà Nội ~2h; xe đạp thuê tại Ninh Bình là lý tưởng.",
    activities: [
      { dayPart: "Sáng", title: "Chèo thuyền Tràng An / Tam Cốc", tip: "Đội mũ lá, nón; đi sớm ít đông hơn." },
      { dayPart: "Chiều", title: "Leo Hang Múa 500 bậc thang", tip: "Mang giày đế bám; leo lúc 15h–17h để tránh nắng." },
      { dayPart: "Tối", title: "Dê núi Ninh Bình & cơm cháy", tip: "Đặc sản phải thử; hỏi quán địa phương gần khách sạn." }
    ]
  },
  {
    id: "hue", name: "Huế", region: "Thừa Thiên-Huế",
    tags: ["văn hóa", "ẩm thực"], budget: 1, pace: "cham",
    habits: ["cặp đôi", "đi một mình"],
    interests: ["cố đô", "lăng tẩm", "ẩm thực cung đình", "UNESCO"],
    meta: "Cố đô lăng tẩm & ẩm thực cung đình",
    text: "Đại Nội, Lăng Khải Định, cơm hến và bún bò.",
    image: "https://images.unsplash.com/photo-1553641717-5d11dc00c947?w=800&q=80",
    lat: 16.4637, lng: 107.5909, top: false,
    transportTips: "Tàu hỏa hoặc bay Phú Bài; thuê xe máy tham quan lăng tẩm ngoại ô.",
    activities: [
      { dayPart: "Sáng", title: "Hoàng Thành & Đại Nội", tip: "Mặc kín đáo vào điện thờ; đi sớm tránh đoàn du lịch." },
      { dayPart: "Chiều", title: "Lăng Khải Định & Lăng Minh Mạng", tip: "Thuê xe ôm hoặc xe máy đi hết loạt lăng 1 ngày." },
      { dayPart: "Tối", title: "Phố Tây & bún bò Huế", tip: "Chợ Đông Ba mua đặc sản mang về." }
    ]
  },
  {
    id: "phan-thiet", name: "Mũi Né – Phan Thiết", region: "Bình Thuận",
    tags: ["biển", "ẩm thực", "nghỉ dưỡng"], budget: 2, pace: "cham",
    habits: ["cặp đôi", "gia đình"],
    interests: ["biển", "đồi cát", "kitesurfing", "resort"],
    meta: "Đồi cát đỏ & biển xanh lẻ lặng",
    text: "Trượt cát, nhà thờ cát, kite-surf và resort ven biển.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
    lat: 10.9804, lng: 108.2591, top: false,
    transportTips: "Xe khách/tàu hỏa từ TP.HCM ~4h; nhiều resort đón xe từ TP.HCM.",
    activities: [
      { dayPart: "Sáng", title: "Đồi Cát Đỏ / Bàu Trắng", tip: "Đi 5h30–7h chụp ảnh đẹp; tránh trưa nóng 40°C." },
      { dayPart: "Chiều", title: "Kite-surf / tắm biển Mũi Né", tip: "Mùa gió NE (tháng 10–4) tốt nhất cho kite." },
      { dayPart: "Tối", title: "Chợ hải sản Phan Thiết", tip: "Ghẹ, tôm hùm — hỏi giá /con trước khi chọn." }
    ]
  },
  {
    id: "tphcm", name: "TP. Hồ Chí Minh", region: "TP.HCM",
    tags: ["ẩm thực", "văn hóa"], budget: 2, pace: "nhanh",
    habits: ["cú đêm", "gia đình", "đi một mình"],
    interests: ["mua sắm", "ẩm thực", "lịch sử", "nightlife"],
    meta: "Thành phố sôi động nhất Việt Nam",
    text: "Dinh Độc Lập, chợ Bến Thành, Bình Quới và về đêm.",
    image: "https://images.unsplash.com/photo-1583417319070-4a69db38a483?w=800&q=80",
    lat: 10.8231, lng: 106.6297, top: false,
    transportTips: "Grab tiện lợi nhất; xe buýt BRT thử đường dài; tránh giờ cao điểm 7–9h & 17–19h.",
    activities: [
      { dayPart: "Sáng", title: "Dinh Độc Lập & Bảo tàng Chứng tích Chiến tranh", tip: "Mua vé online; trang phục lịch sự." },
      { dayPart: "Chiều", title: "Chợ Bến Thành & phố Tây Bùi Viện", tip: "Mặc cả ~30–50% ở chợ; cẩn thận móc túi." },
      { dayPart: "Tối", title: "Bánh mì, hủ tiếu nam vang & bar rooftop", tip: "Buffet rooftop nhiều lựa chọn tầm nhìn 360°." }
    ]
  },
  {
    id: "con-dao", name: "Côn Đảo", region: "Bà Rịa - Vũng Tàu",
    tags: ["biển", "nghỉ dưỡng"], budget: 3, pace: "cham",
    habits: ["cặp đôi", "đi một mình"],
    interests: ["biển hoang", "rùa biển", "lịch sử", "lặn biển"],
    meta: "Thiên đường biển hoang sơ",
    text: "Rùa biển đẻ trứng, lặn ngắm san hô và nhà tù lịch sử.",
    image: "https://images.unsplash.com/photo-1559592413-7cec096d7b88?w=800&q=80",
    lat: 8.6914, lng: 106.6061, top: true,
    transportTips: "Bay từ TP.HCM ~50 phút; thuê xe máy trên đảo; mùa rùa: tháng 5–10.",
    activities: [
      { dayPart: "Sáng", title: "Bãi Đầm Trầu / Bãi Ông Đụng", tip: "Nước xanh trong; mang đồ snorkel riêng." },
      { dayPart: "Chiều", title: "Vườn Quốc gia Côn Đảo", tip: "Đăng ký xem rùa tối tại Ban quản lý sớm." },
      { dayPart: "Tối", title: "Thăm Nghĩa trang Hàng Dương", tip: "Trang nghiêm; không chụp ảnh nếu không được cho phép." }
    ]
  },
  {
    id: "ha-giang", name: "Hà Giang", region: "Hà Giang",
    tags: ["leo núi", "văn hóa"], budget: 1, pace: "nhanh",
    habits: ["đi một mình", "đi sớm"],
    interests: ["trekking", "moto", "bản làng", "check-in"],
    meta: "Cung đường đèo hiểm trở & hoa tam giác mạch",
    text: "Cung đường Mã Pí Lèng, Đồng Văn Cổ Trấn và hoa tam giác mạch.",
    image: "https://images.unsplash.com/photo-1574270981993-c4a1b6c9a1d7?w=800&q=80",
    lat: 23.2241, lng: 104.9834, top: true,
    transportTips: "Xe khách từ Hà Nội ~7h; thuê moto tại thị xã hoặc đặt off-road tour có guide.",
    activities: [
      { dayPart: "Sáng", title: "Cột cờ Lũng Cú — điểm cực Bắc VN", tip: "Leo 389 bậc; ảnh cờ đỏ cực đẹp bình minh." },
      { dayPart: "Chiều", title: "Đèo Mã Pí Lèng — đèo hùng vĩ nhất VN", tip: "Lái xe cẩn thận; đường hẹp, vực sâu." },
      { dayPart: "Tối", title: "Chợ đêm Đồng Văn", tip: "Mèn mén, thắng cố ngựa — đặc sản Hà Giang." }
    ]
  },
  {
    id: "quy-nhon", name: "Quy Nhơn", region: "Bình Định",
    tags: ["biển", "văn hóa"], budget: 1, pace: "cham",
    habits: ["đi một mình", "cặp đôi"],
    interests: ["biển vắng", "Chăm Pa", "hải sản rẻ", "bình yên"],
    meta: "Biển đẹp ít người, tháp Chăm cổ kính",
    text: "Bãi Kỳ Co, tháp Chăm Bánh Ít và chả cá Quy Nhơn.",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    lat: 13.7765, lng: 109.2235, top: false,
    transportTips: "Bay thẳng Phù Cát; Grab rẻ hơn TP lớn; thuê xe máy đi Kỳ Co.",
    activities: [
      { dayPart: "Sáng", title: "Bãi Kỳ Co & Hòn Khô", tip: "Đặt thuyền sớm; nước trong xanh nhất buổi sáng." },
      { dayPart: "Chiều", title: "Tháp Đôi & Tháp Bánh Ít Chăm Pa", tip: "Thăm miễn phí; mang nón rộng vành." },
      { dayPart: "Tối", title: "Bún chả cá & chợ đêm ẩm thực", tip: "Hải sản cực tươi và giá bình dân." }
    ]
  },
  {
    id: "buon-ma-thuot", name: "Buôn Ma Thuột", region: "Đắk Lắk",
    tags: ["văn hóa", "ẩm thực"], budget: 1, pace: "cham",
    habits: ["đi một mình", "gia đình"],
    interests: ["cà phê", "voi", "thác", "bản làng"],
    meta: "Thủ đô cà phê & văn hóa Tây Nguyên",
    text: "Buôn làng Ê Đê, thác Gia Long và cà phê chồn nổi tiếng.",
    image: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80",
    lat: 12.6797, lng: 108.0506, top: false,
    transportTips: "Bay thẳng hoặc xe khách từ TP.HCM ~8h; thuê xe máy thăm vùng ngoại ô.",
    activities: [
      { dayPart: "Sáng", title: "Vườn cà phê & trải nghiệm hái cà phê", tip: "Mùa thu hoạch tháng 11–1; đặt tour trước." },
      { dayPart: "Chiều", title: "Thác Gia Long hoặc Đồi Tình Yêu", tip: "Mưa nhiều cuối năm — kiểm tra đường." },
      { dayPart: "Tối", title: "Cơm lam, rượu cần tại buôn làng", tip: "Tham gia lễ hội dân tộc nếu trùng lịch." }
    ]
  },
  {
    id: "tam-dao", name: "Tam Đảo", region: "Vĩnh Phúc",
    tags: ["leo núi", "nghỉ dưỡng"], budget: 1, pace: "cham",
    habits: ["gia đình", "cặp đôi"],
    interests: ["núi", "sương mù", "nghỉ dưỡng", "thiên nhiên"],
    meta: "Núi sương mù gần Hà Nội",
    text: "Thị trấn trong mây, leo đỉnh Tam Đảo và chùa Tây Thiên.",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
    lat: 21.4684, lng: 105.6436, top: false,
    transportTips: "Ô tô từ Hà Nội ~1.5h; đường núi dốc — cẩn thận khi mưa.",
    activities: [
      { dayPart: "Sáng", title: "Leo đỉnh Phù Nghĩa hoặc Tam Đảo", tip: "Xuất phát sớm; sương tan lúc 9–10h." },
      { dayPart: "Chiều", title: "Chùa Tây Thiên & rừng nguyên sinh", tip: "Trang phục lịch sự vào chùa." },
      { dayPart: "Tối", title: "Đặc sản lợn cắp nách & su su xào tỏi", tip: "Thị trấn nhỏ — chọn nhà hàng có đánh giá tốt." }
    ]
  },
  {
    id: "mui-ne-fantasy", name: "Làng Chài Cổ Thạch", region: "Bình Thuận",
    tags: ["biển", "văn hóa"], budget: 1, pace: "cham",
    habits: ["đi một mình", "cặp đôi"],
    interests: ["biển đá", "nhiếp ảnh", "yên tĩnh", "bình minh"],
    meta: "Bãi đá huyền bí & ngư dân địa phương",
    text: "Triều thấp lộ bãi đá san hô, làng chài cổ kính và bình minh đẹp nhất VN.",
    image: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80",
    lat: 11.1543, lng: 108.3522, top: false,
    transportTips: "Xe máy từ Phan Thiết ~50 km; đi vào lúc nước ròng (tra thủy triều trước).",
    activities: [
      { dayPart: "Sáng", title: "Chụp ảnh bãi đá lúc bình minh & nước ròng", tip: "Dậy 4h30 để có mặt lúc 5h; đi dép xỉn chống trơn." },
      { dayPart: "Chiều", title: "Ghé làng chài Cổ Thạch mua hải sản", tip: "Mang mát theo uống; ít quán ăn khu này." },
      { dayPart: "Tối", title: "Bộ sưu tầm ảnh hoàng hôn tại bãi", tip: "Trời quang thì cực đẹp; mang máy ảnh tốt." }
    ]
  },
  {
    id: "sapa-fansipan", name: "Đỉnh Fansipan", region: "Lào Cai",
    tags: ["leo núi", "văn hóa"], budget: 2, pace: "nhanh",
    habits: ["đi một mình", "gia đình"],
    interests: ["trekking", "cáp treo", "săn mây", "đỉnh núi"],
    meta: "Nóc nhà Đông Dương 3.143m",
    text: "Đỉnh núi cao nhất Việt Nam và ban đảo Đông Dương. Đi cáp treo ngắm toàn cảnh thung lũng Mường Hoa hoặc trekking thử thách bản thân.",
    image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=800&q=80",
    lat: 22.3045, lng: 103.7719, top: true,
    transportTips: "Cáp treo Sun World Fansipan Legend là cách dễ dàng nhất để lên đỉnh trong 15 phút.",
    activities: [
      { dayPart: "Sáng", title: "Đi cáp treo lúc bình minh", tip: "Mây thường phủ vào sáng sớm, có thể trúng khoảnh khắc biển mây cực đẹp." },
      { dayPart: "Trưa", title: "Ăn buffet tại Ga Hoàng Liên", tip: "Giá vé cáp treo kết hợp buffet thường rẻ hơn mua lẻ." },
      { dayPart: "Chiều", title: "Viếng quần thể tâm linh", tip: "Có đại tượng Phật A Di Đà lớn nhất Việt Nam ở độ cao ấn tượng." }
    ]
  },
  {
    id: "moc-chau", name: "Mộc Châu", region: "Sơn La",
    tags: ["văn hóa", "nghỉ dưỡng"], budget: 1, pace: "cham",
    habits: ["cặp đôi", "gia đình"],
    interests: ["đồi chè", "hái dâu", "bản làng", "rừng thông"],
    meta: "Thảo nguyên xanh mát, hoa mận trắng",
    text: "Mộc Châu quyến rũ với đồi chè trái tim, rừng thông bản Áng, thác Dải Yếm và những vườn mận nở trắng muốt khi xuân về.",
    image: "https://images.unsplash.com/photo-1467377791767-c929b5dc9a23?w=800&q=80",
    lat: 20.8542, lng: 104.6465, top: false,
    transportTips: "Xe limousine từ Hà Nội đi Mộc Châu tốn khoảng 4 giờ qua quốc lộ 6.",
    activities: [
      { dayPart: "Sáng", title: "Tham quan Đồi Chè Trái Tim", tip: "Nắng sớm chiếu lên lá chè đọng sương cực kỳ ăn ảnh." },
      { dayPart: "Chiều", title: "Rừng thông Bản Áng & Hái dâu tây", tip: "Điểm cắm trại tuyệt vời, dâu tây ngon nhất vào mùa lạnh (Tháng 1-3)." },
      { dayPart: "Tối", title: "Thưởng thức Bê chao vỉa hè", tip: "Ghé quán 64 hoặc 70 để thử đặc sản bê chao siêu ngon." }
    ]
  },
  {
    id: "phong-nha", name: "Phong Nha - Kẻ Bàng", region: "Quảng Bình",
    tags: ["leo núi", "nghỉ dưỡng"], budget: 2, pace: "nhanh",
    habits: ["đi một mình", "cặp đôi"],
    interests: ["hang động", "trekking", "chèo thuyền", "di sản"],
    meta: "Vương quốc hang động thế giới",
    text: "Vườn quốc gia với hơn 300 hang động lớn nhỏ, sông ngầm hùng vĩ. Là nơi có động Sơn Đoòng lớn nhất thế giới.",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
    lat: 17.5898, lng: 106.281, top: true,
    transportTips: "Nên thuê xe máy từ ga Đồng Hới hoặc bay tới sân bay Đồng Hới.",
    activities: [
      { dayPart: "Sáng", title: "Khám phá động Tiên Sơn / Động Thiên Đường", tip: "Mang giày cực êm vì khoảng cách đi bộ trong hang động mất ít nhất 1.5h." },
      { dayPart: "Chiều", title: "Zipline & Tắm bùn tại Sông Chày Hang Tối", tip: "Chuẩn bị đồ bơi vì trò chơi trên sông và lội bùn sẽ làm bạn ướt hoàn toàn." },
      { dayPart: "Tối", title: "Ăn Gà nướng chấm muối cheo", tip: "Khá nhiều quán nướng cực ngon ven bờ sông Son thơ mộng." }
    ]
  },
  {
    id: "pu-luong", name: "Pù Luông", region: "Thanh Hóa",
    tags: ["leo núi", "văn hóa", "nghỉ dưỡng"], budget: 2, pace: "cham",
    habits: ["gia đình", "cặp đôi"],
    interests: ["ruộng bậc thang", "bảo tồn", "nghỉ dưỡng", "chụp ảnh"],
    meta: "Thiên đường hoang sơ xứ Thanh",
    text: "Khu bảo tồn thiên nhiên tuyệt đẹp với những khu resort sinh thái hòa vào ruộng bậc thang bạt ngàn và nhịp sống thanh bình của người Thái.",
    image: "https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&q=80",
    lat: 20.4633, lng: 105.2154, top: false,
    transportTips: "Cách Hà Nội khoảng 4 tiếng ô tô, đường đi có đèo hơi hẹp đoạn qua Bản Lác - Mai Châu.",
    activities: [
      { dayPart: "Sáng", title: "Đi bộ Bản Đôn và xem guồng nước", tip: "Các guồng nước khổng lồ là góc Check-in rất ăn ảnh." },
      { dayPart: "Chiều", title: "Bơi vô cực ngắm ruộng bậc thang", tip: "Chọn resort có hồ bơi tràn bờ (ví dụ Pu Luong Retreat) để thư giãn trọn vẹn." },
      { dayPart: "Tối", title: "Múa sạp, múa xòe và Vịt Cổ Lũng", tip: "Đặc sản Vịt Cổ Lũng xương nhỏ thịt chắc, ăn kèm xôi nếp." }
    ]
  },
  {
    id: "phu-yen", name: "Phú Yên", region: "Phú Yên",
    tags: ["biển", "văn hóa"], budget: 1, pace: "cham",
    habits: ["đi một mình", "gia đình"],
    interests: ["biển đá", "yên tĩnh", "nhiếp ảnh", "ẩm thực"],
    meta: "Xứ sở hoa vàng trên cỏ xanh",
    text: "Phú Yên nổi bật với Gành Đá Đĩa kỳ thú, hải đăng Mũi Điện - nơi đón bình minh đầu tiên sớm nhất, cùng những bãi biển xanh ngắt chưa nhiều dấu chân ngươì.",
    image: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80",
    lat: 13.0886, lng: 109.3243, top: true,
    transportTips: "Sân bay Tuy Hòa cách trung tâm chỉ 5-7km; thuê xe máy dọc biển rất đẹp.",
    activities: [
      { dayPart: "Sáng", title: "Đón bình minh ở Mũi Điện cực Đông", tip: "Cần tới trước 5h sáng, có một đoạn đi bộ lên ngọn hải đăng." },
      { dayPart: "Chiều", title: "Gành Đá Đĩa & Bãi Xép", tip: "Nắng chói, nhất định mang ô/dù. Vé tham quan khá rẻ." },
      { dayPart: "Tối", title: "Cá ngừ đại dương mù tạt", tip: "Món mắt cá ngừ tiềm thuốc bắc và sashimi cá ngừ là tinh hoa Phú Yên." }
    ]
  }
];

async function importPlaces() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB...');

    let added = 0, updated = 0, skipped = 0;

    // Lấy một tài khoản doanh nghiệp mặc định để gán cho các dịch vụ nếu chưa có owner
    let defaultOwner = await User.findOne({ role: 'business' });
    if (!defaultOwner) {
      // Tạo một owner tạm thời nếu chưa có bất kỳ business nào trong DB mới
      defaultOwner = { _id: new mongoose.Types.ObjectId() }; 
    }

    for (const placeData of PLACES) {
      // 1. Đồng bộ sang Place (Hệ thống cũ)
      const existingPlace = await Place.findOne({ id: placeData.id });
      if (existingPlace) {
        await Place.findOneAndUpdate({ id: placeData.id }, placeData, { runValidators: true });
        updated++;
        console.log(`  🔄 [Legacy] Cập nhật: ${placeData.name}`);
      } else {
        await new Place(placeData).save();
        added++;
        console.log(`  ➕ [Legacy] Thêm mới: ${placeData.name}`);
      }

      // 2. Đồng bộ sang Service (Hệ thống mới cho Business Dashboard)
      const serviceData = {
        name: placeData.name,
        price: placeData.priceFrom || 1000000,
        location: placeData.region,
        category: placeData.isTour ? 'tour' : 'restaurant', // Mặc định
        status: 'active',
        image: placeData.image,
        owner: placeData.ownerId || defaultOwner._id,
        legacyId: placeData.id // Khóa chính để ánh xạ từ User Portal
      };

      const existingService = await Service.findOne({ legacyId: placeData.id });
      if (existingService) {
        await Service.findOneAndUpdate({ legacyId: placeData.id }, serviceData);
        console.log(`  🔄 [New API] Đồng bộ Service: ${placeData.name}`);
      } else {
        await new Service(serviceData).save();
        console.log(`  ➕ [New API] Tạo Service mới: ${placeData.name}`);
      }
    }

    console.log(`\n🎉 Hoàn thành! Thêm mới: ${added} | Cập nhật: ${updated} | Bỏ qua: ${skipped}`);
    console.log(`📊 Tổng số điểm đến trong DB: ${await Place.countDocuments()}`);
  } catch (err) {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Đã ngắt kết nối MongoDB.');
  }
}

importPlaces();
