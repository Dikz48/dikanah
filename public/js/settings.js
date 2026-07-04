document.addEventListener('DOMContentLoaded', function() {
  loadSettings();
});

function loadSettings() {
  fetch('/api/settings')
    .then(res => res.json())
    .then(settings => {
      // Theme
      if (settings.theme) {
        document.getElementById('themeSelect').value = settings.theme;
        applyTheme(settings.theme);
      }

      // Model
      if (settings.model) {
        document.getElementById('modelSelect').value = settings.model;
      }

      // Temperature
      if (settings.temperature) {
        document.getElementById('temperature').value = settings.temperature;
        document.getElementById('tempValue').textContent = settings.temperature;
      }

      // Max Tokens
      if (settings.maxTokens) {
        document.getElementById('maxTokens').value = settings.maxTokens;
        document.getElementById('tokensValue').textContent = settings.maxTokens;
      }

      // Top P
      if (settings.topP) {
        document.getElementById('topP').value = settings.topP;
        document.getElementById('topPValue').textContent = settings.topP;
      }

      // System Prompt
      if (settings.systemPrompt) {
        document.getElementById('systemPrompt').value = settings.systemPrompt;
      }
    })
    .catch(err => {
      console.error('Failed to load settings:', err);
      showToast('Gagal memuat settings', 'error');
    });
}

function saveSettings() {
  const settings = {
    theme: document.getElementById('themeSelect').value,
    model: document.getElementById('modelSelect').value,
    temperature: document.getElementById('temperature').value,
    maxTokens: document.getElementById('maxTokens').value,
    topP: document.getElementById('topP').value,
    systemPrompt: document.getElementById('systemPrompt').value
  };

  fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  })
  .then(res => res.json())
  .then(() => {
    showToast('💾 Settings saved!', 'success');
    applyTheme(settings.theme);
  })
  .catch(err => {
    console.error('Save settings error:', err);
    showToast('Gagal menyimpan settings', 'error');
  });
}

function updateTheme() {
  const theme = document.getElementById('themeSelect').value;
  applyTheme(theme);
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.body.style.background = '#f0f0f0';
    document.body.style.color = '#1a1a2e';
    document.querySelectorAll('.glass, .sidebar, .chat-container, .settings-section, .history-item, .support-card, .about-features li')
      .forEach(el => {
        if (el) {
          el.style.background = 'rgba(255, 255, 255, 0.8)';
          el.style.borderColor = 'rgba(0,0,0,0.1)';
        }
      });
  } else {
    document.body.style.background = 'var(--bg-dark)';
    document.body.style.color = 'var(--text-primary)';
    document.querySelectorAll('.glass, .sidebar, .chat-container, .settings-section, .history-item, .support-card, .about-features li')
      .forEach(el => {
        if (el) {
          el.style.background = 'var(--glass)';
          el.style.borderColor = 'rgba(255,255,255,0.1)';
        }
      });
  }
}

function updateParam(param, value) {
  const labelMap = {
    temperature: 'tempValue',
    maxTokens: 'tokensValue',
    topP: 'topPValue'
  };
  
  const labelId = labelMap[param];
  if (labelId) {
    document.getElementById(labelId).textContent = value;
  }
}

function clearCache() {
  if (!confirm('Yakin ingin menghapus cache? Ini tidak akan menghapus chat history.')) return;

  fetch('/api/settings/clear-cache', {
    method: 'POST'
  })
  .then(res => res.json())
  .then(() => {
    showToast('🧹 Cache cleared!', 'success');
  })
  .catch(err => {
    console.error('Clear cache error:', err);
    showToast('Gagal clear cache', 'error');
  });
}

// Global exports
window.saveSettings = saveSettings;
window.updateTheme = updateTheme;
window.updateParam = updateParam;
window.clearCache = clearCache;