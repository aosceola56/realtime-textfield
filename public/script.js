const socket = io();

// ========================[[ USER PROFILE ]]=============================

const getUserProfile = () => {
    let userId = localStorage.getItem('userId');
    let username = localStorage.getItem('username');
    let darkMode = localStorage.getItem('darkMode') === 'true';
    let lastRoom = localStorage.getItem('lastRoom') || 'General';

    if (!userId) {
        userId = `user-${Date.now()}`;
        username = `User${Math.floor(Math.random() * 10000)}`;
        localStorage.setItem('userId', userId);
        localStorage.setItem('username', username);
        localStorage.setItem('darkMode', darkMode);
    }

    return { userId, username, darkMode, lastRoom };
};

const updateUserProfile = (newUsername) => {
    const sanitizedUsername = newUsername.trim();
    if (sanitizedUsername) {
        localStorage.setItem('username', sanitizedUsername);
        profile.username = sanitizedUsername;
        document.getElementById('currentUsername').textContent = sanitizedUsername;
        updateAvatar(sanitizedUsername);
    }
};

const toggleDarkMode = (switchElement) => {
    const isChecked = switchElement.checked;
    profile.darkMode = isChecked;
    localStorage.setItem('darkMode', isChecked);
    document.body.classList.toggle('darkMode', isChecked);
};

const updateAvatar = (name) => {
    const avatar = document.getElementById('profileAvatar');
    if (avatar && name) {
        avatar.textContent = name.charAt(0).toUpperCase();
    }
};

// Initialize profile
const profile = getUserProfile();
document.getElementById('currentUsername').textContent = profile.username;
updateAvatar(profile.username);

// Apply dark mode preference on page load
if (profile.darkMode) {
    document.body.classList.add('darkMode');
    document.querySelector('#darkModeSwitch input').checked = true;
}

// ========================[[ DOM ELEMENTS ]]=============================

const textField = document.getElementById('textField');
const submitButton = document.getElementById('submitButton');
const usernameField = document.getElementById('usernameField');
const updateUsernameButton = document.getElementById('updateUsernameButton');
const editUsernameBtn = document.getElementById('editUsernameBtn');
const usernameEditSection = document.getElementById('usernameEditSection');
const textList = document.getElementById('textList');
const charCounter = document.getElementById('charCounter');
const chatEmptyState = document.getElementById('chatEmptyState');
const chatInputArea = document.getElementById('chatInputArea');
const chatRoomTitle = document.getElementById('chatRoomTitle');
const chatUserCount = document.getElementById('chatUserCount');
const chatMessages = document.getElementById('chatMessages');
const roomListEl = document.getElementById('roomList');
const newRoomInput = document.getElementById('newRoomInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
const charLimit = 500;

let currentRoom = null;

// ========================[[ USERNAME EDITING ]]=============================

editUsernameBtn.onclick = () => {
    const isVisible = usernameEditSection.style.display !== 'none';
    usernameEditSection.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
        usernameField.focus();
    }
};

updateUsernameButton.onclick = commitUsernameChange;
usernameField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commitUsernameChange();
});

function commitUsernameChange() {
    const newUsername = usernameField.value.trim();
    if (newUsername) {
        updateUserProfile(newUsername);
        usernameField.value = '';
        usernameEditSection.style.display = 'none';
        showToast(`Username updated to "${newUsername}"`, 'success');
    }
}

// ========================[[ MESSAGING ]]=============================

submitButton.onclick = submitMessage;
textField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && textField.value.length <= charLimit) submitMessage();
});

function submitMessage() {
    const text = textField.value.trim();
    if (text && text.length <= charLimit && currentRoom) {
        socket.emit('textInput', { userId: profile.userId, username: profile.username, text });
        textField.value = '';
        charCounter.textContent = `0/${charLimit}`;
        charCounter.classList.remove('over-limit');
    }
}

textField.addEventListener('input', () => {
    const len = textField.value.length;
    charCounter.textContent = `${len}/${charLimit}`;

    if (len > charLimit) {
        submitButton.disabled = true;
        charCounter.classList.add('over-limit');
        submitButton.style.cursor = 'not-allowed';
    } else {
        submitButton.disabled = false;
        charCounter.classList.remove('over-limit');
        submitButton.style.cursor = 'pointer';
    }
});

// ========================[[ CHATROOMS ]]=============================

// Render room list
socket.on('roomList', (rooms) => {
    roomListEl.innerHTML = '';
    rooms.forEach(room => {
        const li = document.createElement('li');
        li.className = currentRoom === room.name ? 'active' : '';
        li.innerHTML = `
            <div class="room-name">
                <i class="bi bi-hash"></i>
                <span>${escapeHtml(room.name)}</span>
            </div>
            <span class="room-user-count">${room.userCount}</span>
        `;
        li.onclick = () => joinRoom(room.name);
        roomListEl.appendChild(li);
    });

    // Update active room user count in header
    if (currentRoom) {
        const active = rooms.find(r => r.name === currentRoom);
        if (active) {
            chatUserCount.textContent = `${active.userCount} ${active.userCount === 1 ? 'member' : 'members'} online`;
        }
    }
});

// Join a room
function joinRoom(roomName) {
    if (currentRoom === roomName) return;
    socket.emit('joinRoom', { roomName, userId: profile.userId, username: profile.username });
    closeSidebar();
}

// Server confirms join
socket.on('joinedRoom', (data) => {
    currentRoom = data.roomName;
    localStorage.setItem('lastRoom', currentRoom);

    // Update UI
    chatRoomTitle.innerHTML = `<i class="bi bi-hash"></i> <span>${escapeHtml(data.roomName)}</span>`;
    chatEmptyState.style.display = 'none';
    chatInputArea.style.display = 'block';
    textList.innerHTML = ''; // Clear messages from previous room
    textField.focus();

    // Highlight active room in sidebar
    document.querySelectorAll('.room-list li').forEach(li => {
        const name = li.querySelector('.room-name span').textContent;
        li.className = name === currentRoom ? 'active' : '';
    });
});

// Auto-join after room creation
socket.on('autoJoinRoom', (data) => {
    joinRoom(data.roomName);
});

// Create room
createRoomBtn.onclick = createRoom;
newRoomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createRoom();
});

function createRoom() {
    const name = newRoomInput.value.trim();
    if (name) {
        socket.emit('createRoom', { roomName: name, userId: profile.userId, username: profile.username });
        newRoomInput.value = '';
    }
}

// ========================[[ MESSAGE RENDERING ]]=============================

socket.on('textUpdate', (data) => {
    const { username, text, timestamp } = data;

    const messageLi = document.createElement('li');
    messageLi.innerHTML = `<span class="messageTime">${timestamp}</span> <span class="messageUsername">${escapeHtml(username)}</span> <span class="messageText">${escapeHtml(text)}</span>`;
    textList.appendChild(messageLi);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('systemMessage', (data) => {
    const li = document.createElement('li');
    li.className = 'system-message';
    li.textContent = `${data.timestamp} — ${data.text}`;
    textList.appendChild(li);

    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// ========================[[ ERROR HANDLING ]]=============================

socket.on('error', (data) => {
    showToast(data.message, 'error');
});

// ========================[[ SIDEBAR TOGGLE (MOBILE) ]]=============================

// Create overlay element for mobile
const overlay = document.createElement('div');
overlay.className = 'sidebar-overlay';
document.body.appendChild(overlay);

sidebarToggleBtn.onclick = () => {
    sidebar.classList.add('open');
    overlay.classList.add('active');
};

function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
}

sidebarCloseBtn.onclick = closeSidebar;
overlay.onclick = closeSidebar;

// ========================[[ TOAST SYSTEM ]]=============================

function showToast(message, type = 'success') {
    const toastContainer = document.querySelector('.toast-container');

    const toast = document.createElement('div');
    toast.classList.add('toast', type);

    toast.innerHTML = `
        <div class="toast-content">
            <i class="bi icon bi-${getIcon(type)}"></i>
            <div class="message">
                <span class="text text-1">${capitalize(type)}</span>
                <span class="text text-2">${escapeHtml(message)}</span>
            </div>
        </div>
        <i class="bi bi-x-lg close"></i>
        <div class="progress active"></div>
    `;

    toastContainer.appendChild(toast);
    const showTimeout = setTimeout(() => {
        void toast.offsetHeight;
        toast.classList.add('active');
    }, 1);

    const closeIcon = toast.querySelector('.close');

    const timer1 = setTimeout(() => {
        toast.classList.remove('active');
    }, 5000);

    const timer2 = setTimeout(() => {
        toast.querySelector('.progress').classList.remove('active');
        setTimeout(() => toast.remove(), 400);
    }, 5300);

    closeIcon.addEventListener('click', () => {
        toast.classList.remove('active');
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(showTimeout);
        setTimeout(() => toast.remove(), 400);
    });
}

function getIcon(type) {
    switch (type) {
        case 'success': return 'check-circle-fill';
        case 'error': return 'x-circle-fill';
        case 'warning': return 'exclamation-triangle-fill';
        case 'info': return 'info-circle-fill';
        default: return 'check-circle-fill';
    }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ========================[[ LENIS SMOOTH SCROLL ]]=============================

const lenis = new Lenis({
    lerp: 0.2,
    smooth: true,
    direction: 'vertical',
});
function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// ========================[[ DOT CANVAS BACKGROUND ]]=============================

const dotScaleFactor = 9;
const dotScaleRadius = 0.4;
const dotSpacing = 30;
const dotRadius = 1.1;

const canvas = document.getElementById('dot-canvas');
const ctx = canvas.getContext('2d');
const dots = [];

function populateDots() {
    const numDotsX = Math.floor(window.innerWidth / dotSpacing);
    const numDotsY = Math.floor(window.innerHeight / dotSpacing);
    dots.length = 0;

    for (let i = 0; i < numDotsX; i++) {
        for (let j = 0; j < numDotsY; j++) {
            dots.push({
                x: i * dotSpacing + dotSpacing / 2,
                y: j * dotSpacing + dotSpacing / 2,
                radius: dotRadius
            });
        }
    }
}

function drawDots() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    dots.forEach(dot => {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
    });
}

function updateCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    populateDots();
    drawDots();
}

window.addEventListener('resize', updateCanvas);
window.addEventListener('mousemove', function (e) {
    dots.forEach(dot => {
        const dx = e.clientX - dot.x;
        const dy = e.clientY - dot.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        dot.radius = dotRadius * (1 + Math.max(0, dotScaleRadius - distance / 100) * dotScaleFactor);
    });
    drawDots();
});
updateCanvas();

// ========================[[ AUTO-JOIN LAST ROOM ]]=============================

// Wait for the room list to arrive, then auto-join
let hasAutoJoined = false;
socket.on('roomList', () => {
    if (!hasAutoJoined) {
        hasAutoJoined = true;
        const roomToJoin = profile.lastRoom || 'General';
        joinRoom(roomToJoin);
    }
});