// Select Elements
const authScreen = document.getElementById('auth-screen');
const authForm = document.getElementById('auth-form');
const passwordInput = document.getElementById('password-input');
const authError = document.getElementById('auth-error');

const mainScreen = document.getElementById('main-screen');
const trackpad = document.getElementById('trackpad');
const touchIndicator = document.getElementById('touch-indicator');
const connectionStatus = document.getElementById('connection-status');
const statusText = connectionStatus.querySelector('.status-text');

const scrollWheel = document.getElementById('scroll-wheel');
const scrollContainer = document.querySelector('.scroll-container');

const btnMenu = document.getElementById('btn-menu');
const settingsDrawer = document.getElementById('settings-drawer');
const btnCloseDrawer = document.getElementById('btn-close-drawer');

const sliderSensitivity = document.getElementById('sensitivity');
const sensitivityValue = document.getElementById('sensitivity-value');
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnScrollbarToggle = document.getElementById('btn-scrollbar-toggle');
const btnNaturalScrollToggle = document.getElementById('btn-natural-scroll-toggle');
const btnHorizontalModeToggle = document.getElementById('btn-horizontal-mode-toggle');
const toastEl = document.getElementById('toast');
const toastMessageEl = document.getElementById('toast-message');

// State Variables
let socket = null;
let isAuthenticated = false;
let storedPassword = localStorage.getItem('trackpad_password') || '';
let sensitivity = parseFloat(localStorage.getItem('trackpad_sensitivity') || '1.5');
let isScrollbarEnabled = localStorage.getItem('trackpad_scrollbar') !== 'false';
let isNaturalScroll = localStorage.getItem('trackpad_natural_scroll') !== 'false';
let isHorizontalMode = localStorage.getItem('trackpad_horizontal_mode') === 'true';

// Touch state variables
let lastTouchX = 0;
let lastTouchY = 0;
let isTouchingTrackpad = false;
let touchStartTime = 0;
let startTouchX = 0;
let startTouchY = 0;
let hasMovedSignificantly = false;

// Tap-to-drag state variables
let lastReleaseTime = 0;
let lastReleaseX = 0;
let lastReleaseY = 0;
let isDraggingSession = false;

// Scroll state variables
let lastScrollX = 0;
let lastScrollY = 0;
let isTouchingScroll = false;

// State Variables for trackpad gestures
let isTwoFingerSession = false;
let lastTwoFingerX = 0;
let lastTwoFingerY = 0;
let startTwoFingerX = 0;
let startTwoFingerY = 0;

// Initialize Settings UI
sliderSensitivity.value = sensitivity;
sensitivityValue.textContent = `${sensitivity.toFixed(1)}x`;


if (isScrollbarEnabled) {
    btnScrollbarToggle.classList.add('active');
    scrollContainer.classList.remove('hidden');
} else {
    btnScrollbarToggle.classList.remove('active');
    scrollContainer.classList.add('hidden');
}

if (isNaturalScroll) {
    btnNaturalScrollToggle.classList.add('active');
} else {
    btnNaturalScrollToggle.classList.remove('active');
}

if (isHorizontalMode) {
    btnHorizontalModeToggle.classList.add('active');
    trackpad.classList.add('horizontal-mode');
    scrollWheel.classList.add('horizontal-mode');
} else {
    btnHorizontalModeToggle.classList.remove('active');
    trackpad.classList.remove('horizontal-mode');
    scrollWheel.classList.remove('horizontal-mode');
}

if (storedPassword) {
    passwordInput.value = storedPassword;
}

// Show Toast Notification
function showToast(message, duration = 3000) {
    toastMessageEl.textContent = message;
    toastEl.classList.add('show');
    toastEl.classList.remove('hidden');
    setTimeout(() => {
        toastEl.classList.remove('show');
        setTimeout(() => toastEl.classList.add('hidden'), 300);
    }, duration);
}

// Trigger Haptic Feedback (Vibration)
function triggerHaptic(duration = 15) {
    if ('vibrate' in navigator) {
        navigator.vibrate(duration);
    }
}

// Connect WebSocket
function connect(password) {
    updateStatus('connecting', 'Connecting...');
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?password=${encodeURIComponent(password)}`;
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        localStorage.setItem('trackpad_password', password);
        isAuthenticated = true;
        authScreen.classList.remove('active');
        mainScreen.classList.add('active');
        updateStatus('connected', 'Connected');
        showToast('Connected to Laptop');
        triggerHaptic(50);
    };
    
    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'auth_success') {
                // Handled
            }
        } catch (e) {
            console.error('Error parsing WS message:', e);
        }
    };
    
    socket.onclose = (event) => {
        console.log('Socket closed:', event);
        socket = null;
        
        if (!isAuthenticated) {
            authError.classList.remove('hidden');
            if (event.code === 4001) {
                authError.textContent = 'Incorrect password. Access denied.';
            } else {
                authError.textContent = 'Connection failed. Is the server running?';
            }
            updateStatus('disconnected', 'Disconnected');
        } else {
            showToast('Disconnected from server. Retrying...');
            updateStatus('disconnected', 'Reconnecting...');
            setTimeout(() => {
                if (isAuthenticated) connect(password);
            }, 3000);
        }
    };
    
    socket.onerror = (error) => {
        console.error('Socket error:', error);
        updateStatus('disconnected', 'Error');
    };
}

function updateStatus(state, text) {
    connectionStatus.className = 'status-badge ' + state;
    statusText.textContent = text;
}

// Send Data Helper
function sendEvent(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    }
}

// Submit Password Form
authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const password = passwordInput.value;
    if (password) {
        connect(password);
    }
});

// Settings Drawer Open/Close Logics
btnMenu.addEventListener('click', () => {
    triggerHaptic(20);
    settingsDrawer.classList.remove('hidden');
});

const closeDrawer = () => {
    triggerHaptic(15);
    settingsDrawer.classList.add('hidden');
};

btnCloseDrawer.addEventListener('click', closeDrawer);
settingsDrawer.addEventListener('click', (e) => {
    if (e.target === settingsDrawer) {
        closeDrawer();
    }
});

// Sensitivity Slider
sliderSensitivity.addEventListener('input', (e) => {
    sensitivity = parseFloat(e.target.value);
    sensitivityValue.textContent = `${sensitivity.toFixed(1)}x`;
    localStorage.setItem('trackpad_sensitivity', sensitivity);
});



// Scrollbar Toggle
btnScrollbarToggle.addEventListener('click', () => {
    isScrollbarEnabled = !isScrollbarEnabled;
    localStorage.setItem('trackpad_scrollbar', isScrollbarEnabled);
    btnScrollbarToggle.classList.toggle('active');
    if (isScrollbarEnabled) {
        scrollContainer.classList.remove('hidden');
        showToast('Scrollbar enabled');
    } else {
        scrollContainer.classList.add('hidden');
        showToast('Scrollbar hidden');
    }
    triggerHaptic(20);
});

// Natural Scroll Toggle
btnNaturalScrollToggle.addEventListener('click', () => {
    isNaturalScroll = !isNaturalScroll;
    localStorage.setItem('trackpad_natural_scroll', isNaturalScroll);
    btnNaturalScrollToggle.classList.toggle('active');
    triggerHaptic(20);
    showToast(isNaturalScroll ? 'Natural scrolling enabled' : 'Traditional scrolling enabled');
});

// Horizontal Mode Toggle
btnHorizontalModeToggle.addEventListener('click', () => {
    isHorizontalMode = !isHorizontalMode;
    localStorage.setItem('trackpad_horizontal_mode', isHorizontalMode);
    btnHorizontalModeToggle.classList.toggle('active');
    if (isHorizontalMode) {
        trackpad.classList.add('horizontal-mode');
        scrollWheel.classList.add('horizontal-mode');
        showToast('Horizontal Mode enabled');
    } else {
        trackpad.classList.remove('horizontal-mode');
        scrollWheel.classList.remove('horizontal-mode');
        showToast('Horizontal Mode disabled');
    }
    triggerHaptic(20);
});

// Fullscreen Toggle
btnFullscreen.addEventListener('click', () => {
    triggerHaptic(20);
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
            .then(() => {
                showToast('Fullscreen Mode');
            })
            .catch(err => {
                showToast('Fullscreen blocked');
            });
    } else {
        document.exitFullscreen();
    }
});

// Trackpad Touch Events
trackpad.addEventListener('touchstart', (e) => {
    const numTouches = e.touches.length;
    
    if (numTouches === 1) {
        // Single finger start
        const touch = e.touches[0];
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        startTouchX = touch.clientX;
        startTouchY = touch.clientY;
        touchStartTime = Date.now();
        isTouchingTrackpad = true;
        hasMovedSignificantly = false;
        isTwoFingerSession = false;
        
        // Check for double-tap-and-hold (tap-to-drag)
        const timeSinceLastRelease = Date.now() - lastReleaseTime;
        const distFromLastRelease = Math.hypot(touch.clientX - lastReleaseX, touch.clientY - lastReleaseY);
        
        if (timeSinceLastRelease < 300 && distFromLastRelease < 35) {
            isDraggingSession = true;
            trackpad.classList.add('dragging');
            triggerHaptic(30); // Distinct vibration for dragging
            sendEvent({
                type: 'click',
                button: 'left',
                action: 'down'
            });
        } else {
            isDraggingSession = false;
            trackpad.classList.remove('dragging');
        }
        
        // Show indicator dot
        const rect = trackpad.getBoundingClientRect();
        touchIndicator.style.left = `${touch.clientX - rect.left}px`;
        touchIndicator.style.top = `${touch.clientY - rect.top}px`;
        touchIndicator.style.transform = 'translate(-50%, -50%) scale(1)';
        touchIndicator.style.opacity = '1';
        
        if (isDraggingSession) {
            touchIndicator.style.borderColor = 'var(--accent-green)'; // Green indicator for drag lock
        } else {
            touchIndicator.style.borderColor = 'var(--primary-cyan)';
        }
    } else if (numTouches === 2) {
        // Two fingers start - start scrolling / multi-finger tap session
        isTwoFingerSession = true;
        isTouchingTrackpad = true;
        hasMovedSignificantly = false;
        touchStartTime = Date.now();
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        lastTwoFingerX = (touch1.clientX + touch2.clientX) / 2;
        lastTwoFingerY = (touch1.clientY + touch2.clientY) / 2;
        startTwoFingerX = lastTwoFingerX;
        startTwoFingerY = lastTwoFingerY;
        
        // Place touch indicator between the two fingers
        const rect = trackpad.getBoundingClientRect();
        const midX = (touch1.clientX + touch2.clientX) / 2;
        const midY = (touch1.clientY + touch2.clientY) / 2;
        touchIndicator.style.left = `${midX - rect.left}px`;
        touchIndicator.style.top = `${midY - rect.top}px`;
        touchIndicator.style.transform = 'translate(-50%, -50%) scale(1.2)';
        touchIndicator.style.borderColor = 'var(--primary-blue)';
    }
});

trackpad.addEventListener('touchmove', (e) => {
    if (!isTouchingTrackpad) return;
    
    const numTouches = e.touches.length;
    
    if (numTouches === 1 && !isTwoFingerSession) {
        // Single finger movement -> move cursor
        const touch = e.touches[0];
        const raw_dx = touch.clientX - lastTouchX;
        const raw_dy = touch.clientY - lastTouchY;
        
        let dx = raw_dx * sensitivity;
        let dy = raw_dy * sensitivity;
        
        if (isHorizontalMode) {
            dx = raw_dy * sensitivity;
            dy = -raw_dx * sensitivity;
        }
        
        const totalDist = Math.hypot(touch.clientX - startTouchX, touch.clientY - startTouchY);
        if (totalDist > 8) {
            hasMovedSignificantly = true;
        }
        
        sendEvent({
            type: 'move',
            dx: dx,
            dy: dy
        });
        
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        
        // Move visual dot
        const rect = trackpad.getBoundingClientRect();
        touchIndicator.style.left = `${touch.clientX - rect.left}px`;
        touchIndicator.style.top = `${touch.clientY - rect.top}px`;
    } else if (numTouches === 2 && isTwoFingerSession) {
        // Two fingers movement -> scroll
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentTwoFingerX = (touch1.clientX + touch2.clientX) / 2;
        const currentTwoFingerY = (touch1.clientY + touch2.clientY) / 2;
        
        const dx = currentTwoFingerX - lastTwoFingerX;
        const dy = currentTwoFingerY - lastTwoFingerY;
        
        let delta = dy;
        let totalDist = Math.abs(currentTwoFingerY - startTwoFingerY);
        
        if (isHorizontalMode) {
            delta = -(currentTwoFingerX - lastTwoFingerX);
            totalDist = Math.abs(currentTwoFingerX - startTwoFingerX);
        }
        
        if (totalDist > 10) {
            hasMovedSignificantly = true;
        }
        
        if (Math.abs(delta) >= 2) {
            const scrollDir = isNaturalScroll ? 1.5 : -1.5;
            sendEvent({
                type: 'scroll',
                dy: delta * scrollDir
            });
            lastTwoFingerY = currentTwoFingerY;
            lastTwoFingerX = currentTwoFingerX;
        }
        
        // Move visual dot between fingers
        const rect = trackpad.getBoundingClientRect();
        const midX = (touch1.clientX + touch2.clientX) / 2;
        const midY = (touch1.clientY + touch2.clientY) / 2;
        touchIndicator.style.left = `${midX - rect.left}px`;
        touchIndicator.style.top = `${midY - rect.top}px`;
    }
});

trackpad.addEventListener('touchend', (e) => {
    if (!isTouchingTrackpad) return;
    
    if (e.touches.length === 0) {
        isTouchingTrackpad = false;
        
        // Record release position and time for tap-to-drag detection
        lastReleaseTime = Date.now();
        lastReleaseX = lastTouchX;
        lastReleaseY = lastTouchY;
        
        // Hide touch indicator
        touchIndicator.style.transform = 'translate(-50%, -50%) scale(0)';
        touchIndicator.style.opacity = '0';
        touchIndicator.style.borderColor = 'var(--primary-cyan)'; // Reset color
        
        const duration = Date.now() - touchStartTime;
        
        if (isDraggingSession) {
            isDraggingSession = false;
            trackpad.classList.remove('dragging');
            triggerHaptic(20);
            sendEvent({
                type: 'click',
                button: 'left',
                action: 'up'
            });
        } else if (isTwoFingerSession) {
            isTwoFingerSession = false;
            
            if (!hasMovedSignificantly && duration < 250) {
                // Two-finger tap -> right click!
                triggerHaptic(25);
                sendEvent({
                    type: 'click',
                    button: 'right',
                    action: 'click'
                });
            }
        } else {
            // Single-finger tap
            if (!hasMovedSignificantly && duration < 250) {
                triggerHaptic(15);
                sendEvent({
                    type: 'click',
                    button: 'left',
                    action: 'click'
                });
            }
        }
    } else if (e.touches.length === 1 && isTwoFingerSession) {
        // Transitioned. Keep treating as a two-finger session until fully lifted.
    }
});

// Scroll Wheel Touch Events
scrollWheel.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        lastScrollX = touch.clientX;
        lastScrollY = touch.clientY;
        isTouchingScroll = true;
        triggerHaptic(10);
    }
});

scrollWheel.addEventListener('touchmove', (e) => {
    if (isTouchingScroll && e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - lastScrollX;
        const dy = touch.clientY - lastScrollY;
        
        let delta = dy;
        if (isHorizontalMode) {
            delta = -dx;
        }
        
        if (Math.abs(delta) >= 2) {
            const scrollDir = isNaturalScroll ? 1.0 : -1.0;
            sendEvent({
                type: 'scroll',
                dy: delta * scrollDir
            });
            lastScrollY = touch.clientY;
            lastScrollX = touch.clientX;
        }
    }
});

scrollWheel.addEventListener('touchend', () => {
    isTouchingScroll = false;
});

// Auto-login if we have a stored password
if (storedPassword) {
    connect(storedPassword);
}
