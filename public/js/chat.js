let currentChatId = null;
let isGenerating = false;
let currentAbortController = null;
let allChats = [];

document.addEventListener('DOMContentLoaded', function() {
  loadChatHistory();
  setupChatEvents();
  focusInput();
  renderChatHistory();
});

function toggleSidebar() {
  const sidebar = document.getElementById('chatSidebar');
  if (sidebar) {
    sidebar.classList.toggle('mobile-open');
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('chatSidebar');
  if (sidebar) {
    sidebar.classList.remove('mobile-open');
  }
}

function newChat() {
  currentChatId = null;
  const chatMessages = document.getElementById('chatMessages');
  if (chatMessages) {
    chatMessages.innerHTML = '';
  }
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = '';
    input.focus();
  }
  closeSidebar();
}

function setupChatEvents() {
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const stopBtn = document.getElementById('stopBtn');

  if (input) {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    input.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 150) + 'px';
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', stopGeneration);
  }
}

function focusInput() {
  const input = document.getElementById('chatInput');
  if (input) {
    setTimeout(() => input.focus(), 100);
  }
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();

  if (!message) return;
  if (isGenerating) return;

  // Check API key
  const hasKey = await checkAPIKey();
  if (!hasKey) {
    showToast('⚠️ API Key belum dikonfigurasi. Buka Settings untuk mengatur.', 'error');
    return;
  }

  // Clear input
  input.value = '';
  input.style.height = 'auto';

  // Disable send button
  const sendBtn = document.getElementById('sendBtn');
  const stopBtn = document.getElementById('stopBtn');
  sendBtn.disabled = true;
  isGenerating = true;
  stopBtn.style.display = 'inline-block';
  updateStatus('thinking');

  // Add user message to chat
  addMessage(message, 'user');
  const assistantId = addTypingIndicator();

  try {
    // Get settings
    const settings = await getSettings();

    console.log('[chat] fetch dimulai -> /api/chat/send', { chatId: currentChatId });

    // Create abort controller for this request
    currentAbortController = new AbortController();

    // Send message to API with streaming
    let response;
    try {
      response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          chatId: currentChatId,
          model: settings.model || 'gpt-4-mini',
          temperature: settings.temperature || 0.7,
          maxTokens: settings.maxTokens || 4096,
          topP: settings.topP || 1.0,
          systemPrompt: settings.systemPrompt || ''
        }),
        signal: currentAbortController.signal
      });
    } catch (networkErr) {
      if (networkErr.name === 'AbortError') {
        console.log('[chat] Request dibatalkan oleh user');
        throw new Error('Request dibatalkan');
      }
      console.error('[chat] fetch gagal (network error):', networkErr);
      throw new Error('❌ Gagal menghubungi server. Periksa koneksi internet Anda.');
    }

    console.log('[chat] fetch selesai, status:', response.status);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Terjadi kesalahan');
    }

    // Handle streaming
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
      try {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        
        // Keep last partial line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.done) {
                if (data.chatId) {
                  currentChatId = data.chatId;
                }
                break;
              }
              if (data.content) {
                fullContent += data.content;
                updateMessage(assistantId, fullContent);
              }
            } catch (parseErr) {
              console.warn('[chat] JSON parse error:', parseErr);
            }
          }
        }
      } catch (readErr) {
        if (readErr.name === 'AbortError') {
          console.log('[chat] Streaming dibatalkan');
          throw new Error('Generation dibatalkan');
        }
        throw readErr;
      }
    }

    // Remove typing indicator and add final message
    console.log('[chat] response diterima penuh, panjang:', fullContent.length);
    removeTypingIndicator(assistantId);
    if (fullContent) {
      addMessage(fullContent, 'assistant', currentChatId);
    }

  } catch (error) {
    console.error('[chat] response gagal:', error);
    removeTypingIndicator(assistantId);
    if (error.message !== 'Request dibatalkan' && error.message !== 'Generation dibatalkan') {
      addMessage(`❌ ${error.message}`, 'assistant');
      showToast(error.message, 'error');
    } else {
      showToast('⏹ Generation diberhentikan', 'info');
    }
  }

  // Reset UI
  sendBtn.disabled = false;
  isGenerating = false;
  stopBtn.style.display = 'none';
  updateStatus('online');
  focusInput();
}

function addMessage(content, role, chatId) {
  const container = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message message-${role}`;

  if (role === 'assistant') {
    // Render markdown
    const parsed = marked.parse(content);
    const sanitized = DOMPurify.sanitize(parsed);
    messageDiv.innerHTML = sanitized;

    // Apply syntax highlighting
    messageDiv.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });

    // Add copy button for code blocks
    messageDiv.querySelectorAll('pre').forEach((pre) => {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-code-btn';
      copyBtn.textContent = '📋 Copy';
      copyBtn.onclick = () => {
        const code = pre.querySelector('code');
        if (code) {
          navigator.clipboard.writeText(code.textContent);
          showToast('Kode berhasil disalin!', 'success');
        }
      };
      pre.style.position = 'relative';
      pre.appendChild(copyBtn);
    });
  } else {
    messageDiv.textContent = content;
  }

  // Add timestamp
  const timestamp = document.createElement('div');
  timestamp.className = 'message-timestamp';
  timestamp.textContent = new Date().toLocaleTimeString();
  messageDiv.appendChild(timestamp);

  container.appendChild(messageDiv);
  container.scrollTop = container.scrollHeight;

  return messageDiv;
}

function addTypingIndicator() {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'message message-assistant typing-indicator';
  div.id = 'typing-indicator';

  const dots = document.createElement('div');
  dots.className = 'typing-dots';
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span');
    dots.appendChild(dot);
  }
  div.appendChild(dots);

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  return div.id;
}

function updateMessage(id, content) {
  const element = document.getElementById(id);
  if (!element) return;

  // Render markdown
  const parsed = marked.parse(content);
  const sanitized = DOMPurify.sanitize(parsed);
  element.innerHTML = sanitized;

  // Apply syntax highlighting
  element.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightElement(block);
  });

  const container = document.getElementById('chatMessages');
  container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator(id) {
  const element = document.getElementById(id);
  if (element) {
    element.remove();
  }
}

function stopGeneration() {
  // Abort the current fetch request
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }

  // Notify server to stop generation
  fetch('/api/chat/stop', {
    method: 'POST'
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      isGenerating = false;
      document.getElementById('stopBtn').style.display = 'none';
      document.getElementById('sendBtn').disabled = false;
      updateStatus('online');
      showToast('⏹ Generation diberhentikan', 'success');
    }
  })
  .catch(err => {
    console.error('Stop error:', err);
  });
}

async function checkAPIKey() {
  try {
    const response = await fetch('/api/settings');
    const settings = await response.json();
    return settings.apiKeyConfigured !== false;
  } catch (error) {
    return false;
  }
}

async function getSettings() {
  try {
    const response = await fetch('/api/settings');
    return await response.json();
  } catch (error) {
    return {};
  }
}

function loadChatHistory() {
  fetch('/api/history?limit=50')
    .then(res => res.json())
    .then(data => {
      allChats = data.chats || [];
      renderChatHistory();
      // Load latest chat if exists
      if (allChats.length > 0) {
        currentChatId = allChats[0].id;
      }
    })
    .catch(err => {
      console.error('Failed to load history:', err);
      showToast('❌ Gagal memuat riwayat chat', 'error');
    });
}

function renderChatHistory() {
  const historyContainer = document.getElementById('chatHistory');
  if (!historyContainer) return;
  
  if (allChats.length === 0) {
    historyContainer.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-secondary); font-size: 0.85rem;">Tidak ada chat</div>';
    return;
  }
  
  historyContainer.innerHTML = allChats.map(chat => `
    <div class="history-item-chat" onclick="selectChat('${chat.id}')">
      <span class="history-item-chat-title">${escapeHtml(chat.title)}</span>
      <div class="history-item-actions">
        <button class="btn-action-small" onclick="renameChat('${chat.id}'); event.stopPropagation();" title="Rename">✎</button>
        <button class="btn-action-small" onclick="deleteChat('${chat.id}'); event.stopPropagation();" title="Delete">🗑</button>
      </div>
    </div>
  `).join('');
}

function selectChat(chatId) {
  currentChatId = chatId;
  const chatMessages = document.getElementById('chatMessages');
  if (chatMessages) {
    chatMessages.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">Memuat chat...</div>';
  }
  closeSidebar();
  
  // Load chat messages
  fetch(`/api/history/${chatId}`)
    .then(res => res.json())
    .then(data => {
      if (chatMessages) {
        chatMessages.innerHTML = '';
      }
      if (data.messages) {
        data.messages.forEach(msg => {
          addMessage(msg.content, msg.role, chatId);
        });
      }
    })
    .catch(err => {
      console.error('Failed to load chat:', err);
      showToast('Gagal memuat chat', 'error');
    });
}

function renameChat(chatId) {
  const newTitle = prompt('Nama baru untuk chat:');
  if (newTitle && newTitle.trim()) {
    // This would typically call an API to rename
    const chat = allChats.find(c => c.id === chatId);
    if (chat) {
      chat.title = newTitle;
      renderChatHistory();
    }
  }
}

function deleteChat(chatId) {
  if (confirm('Yakin ingin menghapus chat ini?')) {
    fetch(`/api/history/${chatId}`, { method: 'DELETE' })
      .then(() => {
        allChats = allChats.filter(c => c.id !== chatId);
        renderChatHistory();
        if (currentChatId === chatId) {
          newChat();
        }
        showToast('Chat dihapus', 'success');
      })
      .catch(err => {
        console.error('Failed to delete chat:', err);
        showToast('Gagal menghapus chat', 'error');
      });
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function exportChat() {
  if (!currentChatId) {
    showToast('Tidak ada chat untuk diexport', 'error');
    return;
  }

  fetch(`/api/history/export/${currentChatId}`)
    .then(res => res.json())
    .then(data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat_${currentChatId}_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('📤 Chat berhasil diexport', 'success');
    })
    .catch(err => {
      console.error('Export error:', err);
      showToast('Gagal export chat', 'error');
    });
}

function clearChat() {
  if (!confirm('Yakin ingin menghapus semua pesan?')) return;

  const container = document.getElementById('chatMessages');
  container.innerHTML = '';
  currentChatId = null;
  showToast('Chat cleared', 'success');
}

// Global exports
window.sendMessage = sendMessage;
window.stopGeneration = stopGeneration;
window.exportChat = exportChat;
window.clearChat = clearChat;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.newChat = newChat;
window.selectChat = selectChat;
window.renameChat = renameChat;
window.deleteChat = deleteChat;