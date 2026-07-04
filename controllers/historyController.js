const { getDb } = require('../database');

exports.getHistory = async (req, res) => {
  try {
    const db = getDb();
    const { limit = 50, offset = 0, search = '' } = req.query;

    let query = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) as message_count,
        (SELECT content FROM messages WHERE chat_id = c.id AND role = 'assistant' ORDER BY timestamp DESC LIMIT 1) as last_message
      FROM chats c
    `;

    let params = [];

    if (search && search.trim() !== '') {
      query += ` WHERE c.title LIKE ? OR EXISTS (
        SELECT 1 FROM messages m WHERE m.chat_id = c.id AND m.content LIKE ?
      )`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY c.pinned DESC, c.updated_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const chats = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ chats, total: chats.length });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getChat = async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const chat = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM chats WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat tidak ditemukan' });
    }

    const messages = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC',
        [id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ chat, messages });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createChat = async (req, res) => {
  try {
    const db = getDb();
    const { title } = req.body;

    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO chats (title, created_at, updated_at) VALUES (?, datetime("now"), datetime("now"))',
        [title || 'Chat Baru'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    res.json({ id: result, title: title || 'Chat Baru' });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateChat = async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { title, folder } = req.body;

    let query = 'UPDATE chats SET updated_at = datetime("now")';
    let params = [];

    if (title !== undefined) {
      query += ', title = ?';
      params.push(title);
    }

    if (folder !== undefined) {
      query += ', folder = ?';
      params.push(folder || null);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await new Promise((resolve, reject) => {
      db.run(query, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Update chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteChat = async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    // Delete all messages first
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM messages WHERE chat_id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Delete chat
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM chats WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.pinChat = async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    await new Promise((resolve, reject) => {
      db.run('UPDATE chats SET pinned = 1, updated_at = datetime("now") WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Pin chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.unpinChat = async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    await new Promise((resolve, reject) => {
      db.run('UPDATE chats SET pinned = 0, updated_at = datetime("now") WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Unpin chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.moveToFolder = async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { folder } = req.body;

    await new Promise((resolve, reject) => {
      db.run('UPDATE chats SET folder = ?, updated_at = datetime("now") WHERE id = ?', [folder || null, id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Move to folder error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.searchChat = async (req, res) => {
  try {
    const db = getDb();
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({ success: false, error: 'Search query required' });
    }

    const chats = await new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT c.*,
          (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) as message_count
         FROM chats c
         LEFT JOIN messages m ON m.chat_id = c.id
         WHERE c.title LIKE ? OR m.content LIKE ?
         ORDER BY c.pinned DESC, c.updated_at DESC`,
        [`%${q}%`, `%${q}%`],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ chats });
  } catch (error) {
    console.error('Search chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.exportChat = async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const chat = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM chats WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat tidak ditemukan' });
    }

    const messages = await new Promise((resolve, reject) => {
      db.all(
        'SELECT role, content, timestamp FROM messages WHERE chat_id = ? ORDER BY timestamp ASC',
        [id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    const exportData = {
      chat: {
        id: chat.id,
        title: chat.title,
        created_at: chat.created_at,
        updated_at: chat.updated_at
      },
      messages: messages
    };

    res.json(exportData);
  } catch (error) {
    console.error('Export chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.importChat = async (req, res) => {
  try {
    const db = getDb();
    const { data } = req.body;

    if (!data || !data.chat || !data.messages) {
      return res.status(400).json({ success: false, error: 'Invalid import data' });
    }

    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO chats (title, created_at, updated_at) VALUES (?, ?, ?)',
        [data.chat.title, data.chat.created_at || new Date().toISOString(), new Date().toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    for (const msg of data.messages) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO messages (chat_id, role, content, timestamp) VALUES (?, ?, ?, ?)',
          [result, msg.role, msg.content, msg.timestamp || new Date().toISOString()],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    res.json({ id: result, success: true });
  } catch (error) {
    console.error('Import chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};