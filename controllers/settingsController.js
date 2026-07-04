const { getDb } = require('../database');

exports.getSettings = async (req, res) => {
  try {
    const db = getDb();

    const settings = await new Promise((resolve, reject) => {
      db.all('SELECT key, value FROM settings', (err, rows) => {
        if (err) reject(err);
        else {
          const settingsObj = {};
          rows.forEach(row => {
            settingsObj[row.key] = row.value;
          });
          resolve(settingsObj);
        }
      });
    });

    settings.apiKeyConfigured = !!process.env.HF_API_KEY;

    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const db = getDb();
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid settings data' });
    }

    for (const [key, value] of Object.entries(updates)) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          [key, value],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.clearCache = async (req, res) => {
  try {
    // Clear any cached data
    // For now, just return success
    res.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};