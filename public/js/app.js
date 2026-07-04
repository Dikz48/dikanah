// Main Application
document.addEventListener('DOMContentLoaded', function() {
  const loadingEl = document.getElementById('loading');
  const mainEl = document.getElementById('main');

  if (loadingEl && mainEl) {
    // Only index.html has the loading screen / sidebar shell
    setTimeout(() => {
      loadingEl.classList.add('hide');
      mainEl.style.display = 'block';
      initializeApp();
    }, 1500);
  } else {
    // Other pages (chat/history/settings/about/support) run immediately
    initializeApp();
  }
});

let aiStatus = 'online';
let currentModel = 'Dikz-4.1-mini';

function initializeApp() {
  // Check API status
  checkAPIStatus();

  // Load settings
  loadSettings();

  // Set up event listeners
  setupEventListeners();
}

function checkAPIStatus() {
  console.log('[app] checking API status...');
  fetch('/health')
    .then(response => {
      if (response.ok) {
        updateStatus('online');
      } else {
        updateStatus('offline');
      }
    })
    .catch(error => {
      console.error('[app] API status check failed:', error);
      updateStatus('offline');
    });
}

function updateStatus(status) {
  aiStatus = status;
  const indicator = document.getElementById('statusIndicator');
  const text = document.getElementById('statusText');

  // statusIndicator/statusText only exist on index.html's sidebar
  if (!indicator || !text) return;

  indicator.className = `status-${status}`;

  if (status === 'online') {
    text.textContent = 'Online';
  } else if (status === 'thinking') {
    text.textContent = 'Thinking...';
  } else {
    text.textContent = 'Offline';
  }
}

function loadSettings() {
  fetch('/api/settings')
    .then(res => res.json())
    .then(settings => {
      if (settings.model) {
        currentModel = settings.model;
      }
      if (settings.theme) {
        applyTheme(settings.theme);
      }
    })
    .catch(err => console.error('Failed to load settings:', err));
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.body.style.background = '#f0f0f0';
    document.body.style.color = '#1a1a2e';
  } else {
    document.body.style.background = 'var(--bg-dark)';
    document.body.style.color = 'var(--text-primary)';
  }
}

function setupEventListeners() {
  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    // Ctrl+Enter to send message
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      const input = document.getElementById('chatInput');
      if (input) {
        sendMessage();
      }
    }
  });
}

function showToast(message, type = 'success') {
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Export functions to global scope
window.showToast = showToast;
window.updateStatus = updateStatus;