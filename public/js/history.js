let currentPage = 0;
const pageSize = 20;

document.addEventListener('DOMContentLoaded', function() {
  loadHistory();
  setupSearch();
});

function loadHistory(page = 0) {
  const search = document.getElementById('searchInput')?.value || '';
  const offset = page * pageSize;

  fetch(`/api/history?limit=${pageSize}&offset=${offset}&search=${encodeURIComponent(search)}`)
    .then(res => res.json())
    .then(data => {
      renderHistory(data.chats || []);
    })
    .catch(err => {
      console.error('Failed to load history:', err);
      showToast('Gagal memuat history', 'error');
    });
}

function renderHistory(chats) {
  const container = document.getElementById('historyList');
  if (!container) return;

  if (chats.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">Belum ada chat</div>
        <div class="empty-desc">Mulai chat baru di halaman Chat</div>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  chats.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const pinIcon = chat.pinned ? '📌' : '';

    item.innerHTML = `
      <div class="history-item-info" onclick="openChat('${chat.id}')">
        <div class="history-item-title">${pinIcon} ${escapeHtml(chat.title)}</div>
        <div class="history-item-meta">
          ${chat.message_count || 0} messages • ${formatDate(chat.updated_at)}
          ${chat.last_message ? `• ${escapeHtml(chat.last_message.slice(0, 50))}...` : ''}
        </div>
      </div>
      <div class="history-item-actions">
        <button onclick="togglePin('${chat.id}', ${chat.pinned})" class="btn-icon" title="Pin">${chat.pinned ? '📌' : '📍'}</button>
        <button onclick="renameChat('${chat.id}')" class="btn-icon" title="Rename">✏️</button>
        <button onclick="deleteChat('${chat.id}')" class="btn-icon" title="Delete">🗑️</button>
      </div>
    `;

    container.appendChild(item);
  });

  // Load more button
  if (chats.length === pageSize) {
    const loadMore = document.createElement('div');
    loadMore.className = 'load-more';
    loadMore.innerHTML = `<button onclick="loadMore()" class="btn-secondary">Load More</button>`;
    container.appendChild(loadMore);
  }
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Baru saja';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} menit lalu`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} jam lalu`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} hari lalu`;
  
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    let timeout;
    searchInput.addEventListener('input', function() {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        loadHistory(0);
      }, 300);
    });
  }
}

function openChat(id) {
  window.location.href = `/chat?id=${id}`;
}

function togglePin(id, currentState) {
  const method = currentState ? 'DELETE' : 'POST';
  fetch(`/api/history/${id}/pin`, { method })
    .then(res => res.json())
    .then(() => {
      loadHistory(currentPage);
      showToast(currentState ? '📌 Unpinned' : '📌 Pinned', 'success');
    })
    .catch(err => {
      console.error('Pin error:', err);
      showToast('Gagal mengubah pin', 'error');
    });
}

function renameChat(id) {
  const newTitle = prompt('Masukkan judul baru:');
  if (newTitle === null) return;
  if (newTitle.trim() === '') {
    showToast('Judul tidak boleh kosong', 'error');
    return;
  }

  fetch(`/api/history/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: newTitle.trim() })
  })
  .then(res => res.json())
  .then(() => {
    loadHistory(currentPage);
    showToast('✏️ Chat renamed', 'success');
  })
  .catch(err => {
    console.error('Rename error:', err);
    showToast('Gagal rename chat', 'error');
  });
}

function deleteChat(id) {
  if (!confirm('Yakin ingin menghapus chat ini?')) return;

  fetch(`/api/history/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(() => {
      loadHistory(currentPage);
      showToast('🗑️ Chat deleted', 'success');
    })
    .catch(err => {
      console.error('Delete error:', err);
      showToast('Gagal delete chat', 'error');
    });
}

function loadMore() {
  currentPage++;
  loadHistory(currentPage);
}

function exportAllChats() {
  fetch('/api/history?limit=1000')
    .then(res => res.json())
    .then(data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all_chats_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('📤 All chats exported', 'success');
    })
    .catch(err => {
      console.error('Export error:', err);
      showToast('Gagal export', 'error');
    });
}

function importChats() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const data = JSON.parse(event.target.result);
        fetch('/api/history/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data })
        })
        .then(res => res.json())
        .then(() => {
          loadHistory(0);
          showToast('📥 Chat imported successfully', 'success');
        })
        .catch(err => {
          console.error('Import error:', err);
          showToast('Gagal import chat', 'error');
        });
      } catch (err) {
        showToast('File tidak valid', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// Search handler
window.searchChat = function(e) {
  if (e.key === 'Enter') {
    loadHistory(0);
  }
};

// Global exports
window.loadHistory = loadHistory;
window.openChat = openChat;
window.togglePin = togglePin;
window.renameChat = renameChat;
window.deleteChat = deleteChat;
window.exportAllChats = exportAllChats;
window.importChats = importChats;