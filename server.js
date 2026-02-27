const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const moment = require('moment');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const charLimit = 500;

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

io.on('connection', (socket) => {
    console.log('A user connected');

    // Listen for user messages
    socket.on('textInput', (data) => {
        // Track time of message
        const now = moment();
        const timestamp = now.format('hh:mm A');

        const { userId, username, text } = data;
        const message = { userId, username, text, timestamp };
        
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

        io.emit('textUpdate', message); // Broadcast to everyone
        console.log(`${message.username}: ${message.text}`);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
