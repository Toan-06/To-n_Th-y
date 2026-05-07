const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;
const userSockets = new Map(); // userId -> Set of socketIds

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        if (!token) return next(new Error('Authentication error: No token provided'));

        try {
            const secret = (process.env.JWT_SECRET || 'wander-viet-secret-key-123').trim();
            const decoded = jwt.verify(token, secret);
            socket.user = decoded;
            next();
        } catch (err) {
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.user.id;
        // console.log(`📡 User connected: ${userId} (${socket.id})`);

        // Track user sockets
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);

        // Join personal rooms for all possible identifiers to ensure reliability
        if (socket.user._id) socket.join(socket.user._id.toString());
        if (socket.user.customId) socket.join(socket.user.customId.toString());
        if (socket.user.id) socket.join(socket.user.id.toString());

        socket.on('join_chat', (targetId) => {
            // User wants to chat with targetId
            // We can use this to track who is looking at what conversation
            socket.chattingWith = targetId;
        });

        socket.on('send_message', async (data) => {
            const { recipientId, text, conversationId } = data;
            if (!recipientId || !text) return;

            // Emit to recipient
            io.to(recipientId).emit('receive_message', {
                senderId: userId,
                senderName: socket.user.name || socket.user.displayName,
                senderAvatar: socket.user.avatar || '',
                text,
                conversationId,
                createdAt: new Date()
            });
        });

        socket.on('disconnect', () => {
            // console.log(`🔌 User disconnected: ${userId} (${socket.id})`);
            const sockets = userSockets.get(userId);
            if (sockets) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    userSockets.delete(userId);
                }
            }
        });
    });

    return io;
};

const getIO = () => {
    if (!io) throw new Error('Socket.io not initialized');
    return io;
};

const sendNotification = (userId, notification) => {
    if (io) {
        io.to(userId).emit('notification', notification);
    }
};

const emitToUser = (userId, event, data) => {
    if (io && userId) {
        io.to(userId.toString()).emit(event, data);
    }
};

// Emit an event to a list of user IDs
const emitToUsers = (userIds, event, data) => {
    if (!io || !userIds || !userIds.length) return;
    userIds.forEach(uid => {
        if (uid) io.to(uid.toString()).emit(event, data);
    });
};

module.exports = {
    initSocket,
    getIO,
    sendNotification,
    emitToUser,
    emitToUsers
};
