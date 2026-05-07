/**
 * mockData.js
 * Centralized mock data for WanderViệt Business Dashboard.
 */

// 1. DANH SÁCH DỊCH VỤ (Services)
const services = [
    {
        id: 'svc-101',
        name: 'Khách sạn Silk Path Grand Resort',
        type: 'hotel',
        price: 3200000,
        unit: 'đêm',
        location: 'Sapa, Lào Cai',
        status: 'active',
        createdDate: '2024-01-15',
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600',
        rating: 4.9,
        bookings: 124,
        capacity: 50
    },
    {
        id: 'svc-102',
        name: 'Tour du thuyền Heritage Bình Chuẩn',
        type: 'tour',
        price: 4500000,
        unit: 'người',
        location: 'Hạ Long, Quảng Ninh',
        status: 'active',
        createdDate: '2024-02-10',
        image: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=600',
        rating: 4.8,
        bookings: 89,
        capacity: 20
    }
];

// 2. DANH SÁCH ĐƠN HÀNG (Orders / Bookings)
const bookings = [
    { id: 'BK-1001', customerName: 'Nguyễn Anh Tuấn', phone: '0901234567', serviceName: 'Tour du thuyền Heritage Bình Chuẩn', date: '2024-05-01', amount: 9000000, guests: 2, status: 'confirmed' },
    { id: 'BK-1002', customerName: 'Lê Thị Mai', phone: '0912345678', serviceName: 'Khách sạn Silk Path Grand Resort', date: '2024-05-01', amount: 3200000, guests: 1, status: 'completed' },
    { id: 'BK-1003', customerName: 'Trần Hoàng Nam', phone: '0987654321', serviceName: 'Nhà hàng Ngon Garden - Ẩm thực Việt', date: '2024-05-02', amount: 1800000, guests: 4, status: 'pending' }
];

// 3. TIN NHẮN & HỘI THOẠI (Messages & Conversations)
const conversations = [
    { 
        id: 'conv-1', 
        customerName: 'Nguyễn Anh Tuấn', 
        avatar: 'https://i.pravatar.cc/150?u=tuan',
        lastMessage: 'Tôi muốn đặt thêm 1 người nữa được không?', 
        time: '10:45',
        status: 'online'
    },
    { 
        id: 'conv-2', 
        customerName: 'Lê Thị Mai', 
        avatar: 'https://i.pravatar.cc/150?u=mai',
        lastMessage: 'Cảm ơn bạn, dịch vụ rất tuyệt vời!', 
        time: '09:30',
        status: 'offline'
    },
    { 
        id: 'conv-3', 
        customerName: 'Trần Hoàng Nam', 
        avatar: 'https://i.pravatar.cc/150?u=nam',
        lastMessage: 'Khách sạn có chỗ đỗ xe hơi không ạ?', 
        time: 'Hôm qua',
        status: 'online'
    }
];

const messages = [
    // Conversation 1
    { id: 'm1', conversationId: 'conv-1', sender: 'customer', content: 'Chào bạn, tôi đã đặt tour du thuyền bên mình.', time: '10:30' },
    { id: 'm2', conversationId: 'conv-1', sender: 'business', content: 'Chào anh Tuấn, WanderViệt đã nhận được đơn hàng của anh ạ. Em có thể hỗ trợ gì thêm không?', time: '10:32' },
    { id: 'm3', conversationId: 'conv-1', sender: 'customer', content: 'Tôi muốn đặt thêm 1 người nữa được không?', time: '10:45' },
    
    // Conversation 2
    { id: 'm4', conversationId: 'conv-2', sender: 'customer', content: 'Khách sạn Silk Path có phục vụ ăn sáng tại phòng không bạn?', time: '09:00' },
    { id: 'm5', conversationId: 'conv-2', sender: 'business', content: 'Chào chị Mai, bên em có phục vụ bữa sáng tại phòng từ 6h đến 10h hàng ngày ạ.', time: '09:15' },
    { id: 'm6', conversationId: 'conv-2', sender: 'customer', content: 'Cảm ơn bạn, dịch vụ rất tuyệt vời!', time: '09:30' },

    // Conversation 3
    { id: 'm7', conversationId: 'conv-3', sender: 'customer', content: 'Khách sạn có chỗ đỗ xe hơi không ạ?', time: '18:20' }
];

// 4. CÁC HÀM TRUY VẤN DỮ LIỆU
function getAllServices() { return services; }
function getBookings() { return bookings; }
function getConversations() { return conversations; }
function getMessages(convId) { 
    return messages.filter(m => m.conversationId === convId); 
}

if (typeof module !== 'undefined') {
    module.exports = { services, bookings, conversations, messages, getAllServices, getBookings, getConversations, getMessages };
}
