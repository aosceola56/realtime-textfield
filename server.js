const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const moment = require('moment');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const charLimit = 500;

// Default chatrooms
const defaultRooms = ['General', 'Random', 'Memes', 'Larping'];

// Track rooms and their metadata
const rooms = new Map();
defaultRooms.forEach(name => {
    rooms.set(name, { name, createdBy: 'system', users: new Set() });
});

// HTTP rate limiter (for static files or other REST endpoints)
const httpRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15-minute window
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use(httpRateLimiter);
app.use(express.static('public'));

// WebSocket rate limiting
const rateLimits = new Map(); // Map to track message counts for each user
const rateLimitWindow = 10 * 1000; // 10 seconds
const maxMessages = 5; // Max messages per window
const enforceRateLimit = (userId) => {
    const currentTime = Date.now();

    // Initialize rate limit tracking for the user
    if (!rateLimits.has(userId)) {
        rateLimits.set(userId, []);
    }

    const timestamps = rateLimits.get(userId);

    // Remove timestamps outside the rate limit window
    while (timestamps.length && timestamps[0] <= currentTime - rateLimitWindow) {
        timestamps.shift();
    }

    // Check if the user has exceeded the message limit
    if (timestamps.length >= maxMessages) {
        return false; // Rate limit exceeded
    }

    // Add the current timestamp
    timestamps.push(currentTime);
    return true; // Within rate limit
};

// Helper: get room list with user counts
function getRoomList() {
    const list = [];
    rooms.forEach((room, name) => {
        list.push({ name, userCount: room.users.size });
    });
    return list;
}

// Broadcast updated room list to everyone
function broadcastRoomList() {
    io.emit('roomList', getRoomList());
}

io.on('connection', (socket) => {
    console.log('A user connected');

    // Send the current room list on connect
    socket.emit('roomList', getRoomList());

    // Track which room this socket is in
    socket.currentRoom = null;
    socket.userId = null;
    socket.username = null;

    // Handle joining a room
    socket.on('joinRoom', (data) => {
        const { roomName, userId, username } = data;

        if (!rooms.has(roomName)) {
            socket.emit('error', { message: 'Room does not exist.' });
            return;
        }

        // Leave previous room if any
        if (socket.currentRoom) {
            socket.leave(socket.currentRoom);
            const prevRoom = rooms.get(socket.currentRoom);
            if (prevRoom) {
                prevRoom.users.delete(socket.id);
                // Notify previous room that user left
                io.to(socket.currentRoom).emit('userLeft', { username: socket.username || username, roomName: socket.currentRoom });
            }
        }

        socket.currentRoom = roomName;
        socket.userId = userId;
        socket.username = username;

        socket.join(roomName);
        rooms.get(roomName).users.add(socket.id);

        // Confirm join to the user
        socket.emit('joinedRoom', { roomName });

        // Notify the room
        io.to(roomName).emit('systemMessage', {
            text: `${username} joined the room`,
            timestamp: moment().format('hh:mm A'),
            roomName
        });

        broadcastRoomList();
    });

    // Handle creating a new room
    socket.on('createRoom', (data) => {
        const { roomName, userId, username } = data;
        const trimmed = roomName.trim();

        if (!trimmed || trimmed.length > 30) {
            socket.emit('error', { message: 'Room name must be 1-30 characters.' });
            return;
        }

        if (rooms.has(trimmed)) {
            socket.emit('error', { message: 'A room with that name already exists.' });
            return;
        }

        rooms.set(trimmed, { name: trimmed, createdBy: userId, users: new Set() });
        broadcastRoomList();

        // Auto-join the created room
        socket.emit('autoJoinRoom', { roomName: trimmed });
    });

    // Listen for user messages
    socket.on('textInput', (data) => {
        // Track time of message
        const now = moment();
        const timestamp = now.format('hh:mm A');

        const { userId, username, text } = data;
        const message = { userId, username, text, timestamp, roomName: socket.currentRoom };

        if (!socket.currentRoom) {
            socket.emit('error', { message: 'You must join a room before sending messages.' });
            return;
        }
        
        // Limit text length
        if (text.length > charLimit) {
            socket.emit('error', { message: `Text exceeds the ${charLimit} character limit.` });
            return;
        }

        // Rate limiting
        if (!enforceRateLimit(userId)) {
            socket.emit('error', { message: 'Rate limit exceeded. Please wait before sending more messages.' });
            return;
        }

        io.to(socket.currentRoom).emit('textUpdate', message); // Broadcast to room
        console.log(`[${socket.currentRoom}] ${message.username}: ${message.text}`);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');

        // Clean up room membership
        if (socket.currentRoom && rooms.has(socket.currentRoom)) {
            const room = rooms.get(socket.currentRoom);
            room.users.delete(socket.id);

            io.to(socket.currentRoom).emit('systemMessage', {
                text: `${socket.username || 'A user'} left the room`,
                timestamp: moment().format('hh:mm A'),
                roomName: socket.currentRoom
            });

            broadcastRoomList();
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
