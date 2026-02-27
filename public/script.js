const socket = io();

// Generate or retrieve a unique user ID and username
const getUserProfile = () => {
    let userId = localStorage.getItem('userId');
    let username = localStorage.getItem('username');
    let darkMode = localStorage.getItem('darkMode') === 'true'; // Default to false if not set

    if (!userId) {
        userId = `user-${Date.now()}`;
        username = `User${Math.floor(Math.random() * 10000)}`;
        localStorage.setItem('userId', userId);
        localStorage.setItem('username', username);
        localStorage.setItem('darkMode', darkMode); // Save default
    }

    return { userId, username, darkMode };
};

// Update username in profile and DOM
const updateUserProfile = (newUsername) => {
    const sanitizedUsername = newUsername.trim();
    if (sanitizedUsername) {
        localStorage.setItem('username', sanitizedUsername);
        profile.username = sanitizedUsername;
        document.getElementById('currentUsername').textContent = sanitizedUsername;
    }
};

// Update dark mode preference in profile and DOM
const toggleDarkMode = (switchElement) => {
    const isChecked = switchElement.checked;
    profile.darkMode = isChecked;
    localStorage.setItem('darkMode', isChecked);
    document.body.classList.toggle('darkMode', isChecked);
};

// Initialize profile
const profile = getUserProfile();
document.getElementById('currentUsername').textContent = profile.username;

// Apply dark mode preference on page load
if (profile.darkMode) {
    document.body.classList.add('darkMode');
    document.querySelector('#darkModeSwitch input').checked = true;
}

// DOM Elements
const textField = document.getElementById('textField');
const submitButton = document.getElementById('submitButton');
const usernameField = document.getElementById('usernameField');
const updateUsernameButton = document.getElementById('updateUsernameButton');
const textList = document.getElementById('textList');
const timeList = document.getElementById('timeList');
const charCounter = document.getElementById('charCounter');
const charLimit = 500;

// Update username on button click
updateUsernameButton.onclick = updateUsername;
// Update username on enter key
usernameField.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') updateUsername();
});
// Updates username locally
function updateUsername() {
    const newUsername = usernameField.value;
    updateUserProfile(newUsername);
    usernameField.value = ''; // Clear the username input
}

// Submit message on button click
submitButton.onclick = submitMessage;
// Allow hitting enter to submit message
textField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && textField.value.length <= charLimit) submitMessage();
});
// Function to submit messages to all users
function submitMessage() {
    const text = textField.value.trim();
    charCounter.textContent = `0/${charLimit}`;
    if (text && text.length <= charLimit) {
        socket.emit('textInput', { userId: profile.userId, username: profile.username, text });
        textField.value = ''; // Clear input field
    }
}

// Limit text field input to set characters in charLimit
textField.addEventListener('input', () => {
    charCounter.textContent = `${textField.value.length}/${charLimit}`;

    if (textField.value.length > charLimit) {
        // over limit
        submitButton.disabled = true;

        charCounter.style.color = "crimson !important";
        submitButton.style.cursor = "not-allowed";
    } else {
        // under limit
        submitButton.disabled = false;

        document.body.classList.contains('darkMode')
            ? charCounter.style.color = "#999999"
            : charCounter.style.color = "#555";
        submitButton.style.cursor = "pointer";
    }
});

// Listen for updates from the server
socket.on('textUpdate', (data) => {
    console.log(data);
    const { username, text, timestamp } = data;

    // Create a list item for the message
    const messageLi = document.createElement('li');
    messageLi.innerHTML = `<span class="messageTime">${timestamp} |</span> <span class="messageUsername">${username}</span>: <span class="messageText">${text}</span>`;
    textList.appendChild(messageLi);

    // Create a separate list item for the timestamp
    /*const timestampLi = document.createElement('li');
    timestampLi.textContent = `${timestamp}`;
    timeList.appendChild(timestampLi);*/
});

// Listen for errors and output them in the console
socket.on('error', (data => {
    showToast(data.message, "error");
}));

// ========================[[ TOAST SYSTEM ]]=============================
function showToast(message, type = "success") {
    const toastContainer = document.querySelector(".toast-container");

    const toast = document.createElement("div");
    toast.classList.add("toast", type);

    toast.innerHTML = `
        <div class="toast-content">
        <i class="bi icon bi-${getIcon(type)}"></i>
        <div class="message">
            <span class="text text-1">${capitalize(type)}</span>
            <span class="text text-2">${message}</span>
        </div>
        </div>
        <i class="bi bi-x-lg close"></i>
        <div class="progress active"></div>
    `;

    toastContainer.appendChild(toast);
    let showToast = setTimeout(() => {
        void toast.offsetHeight;
        toast.classList.add("active");
    }, 1);

    const progress = toast.querySelector(".progress");
    const closeIcon = toast.querySelector(".close");

    // Auto-remove toast after 5s
    const timer1 = setTimeout(() => {
        toast.classList.remove("active");
    }, 5000);

    const timer2 = setTimeout(() => {
        progress.classList.remove("active");
        setTimeout(() => toast.remove(), 400);
    }, 5300);

    // Manual close
    closeIcon.addEventListener("click", () => {
        toast.classList.remove("active");
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(showToast);
        setTimeout(() => toast.remove(), 400);
    });
}
function getIcon(type) {
    switch (type) {
        case "success": return "check-circle-fill";
        case "error": return "x-circle-fill";
        case "warning": return "exclamation-triangle-fill";
        case "info": return "info-circle-fill";
        default: return "check-circle-fill";
    }
}
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}






// Lenis smooth scroll stuff
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




// set background dot effects;
const dotScaleFactor = 9;
const dotScaleRadius = 0.4;
const dotSpacing = 30;
const dotRadius = 1.1;

// initialize canvas stuff
const canvas = document.getElementById('dot-canvas');
const ctx = canvas.getContext('2d');
const dots = [];

function populateDots() {
    const numDotsX = Math.floor(window.innerWidth / dotSpacing); // Number of dots based on width
    const numDotsY = Math.floor(window.innerHeight / dotSpacing); // Number of dots based on height
    dots.length = 0; // Clear existing dots if any

    for (let i = 0; i < numDotsX; i++) {
        for (let j = 0; j < numDotsY; j++) {
            dots.push({
                x: i * dotSpacing + dotSpacing / 2,
                y: j * dotSpacing+ dotSpacing / 2,
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
window.addEventListener('mousemove', function(e) {
    dots.forEach(dot => {
        const dx = e.clientX - dot.x;
        const dy = e.clientY - dot.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        dot.radius = dotRadius * (1 + Math.max(0, dotScaleRadius - distance / 100) * dotScaleFactor); // Adjust radius based on distance
    });
    drawDots();
});
updateCanvas(); // Initial setup and draw

/* TO DO:

MOD index.html so that the charLimit declared in this script is reflected on first page load */