const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

// ===== Schemas =====
const chatSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    pinned: { type: Boolean, default: false },
    folder: { type: String, default: null }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const messageSchema = new mongoose.Schema({
  chat_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true }
});

const folderSchema = new mongoose.Schema(
  { name: { type: String, required: true } },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const Chat = mongoose.model('Chat', chatSchema);
const Message = mongoose.model('Message', messageSchema);
const Setting = mongoose.model('Setting', settingSchema);
const Folder = mongoose.model('Folder', folderSchema);

async function initDatabase() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI belum diset di .env');
  }

  await mongoose.connect(MONGODB_URI);
  console.log('✅ MongoDB connected');

  // Insert default settings kalau belum ada (setara "INSERT OR IGNORE" versi SQLite lama)
  const defaults = [
    { key: 'model', value: process.env.MODEL || 'Qwen/Qwen2.5-7B-Instruct' },
    { key: 'temperature', value: process.env.TEMPERATURE || '0.7' },
    { key: 'max_tokens', value: process.env.MAX_TOKENS || '1024' },
    { key: 'top_p', value: '1.0' },
    { key: 'theme', value: 'dark' }
  ];

  for (const def of defaults) {
    await Setting.updateOne({ key: def.key }, { $setOnInsert: def }, { upsert: true });
  }
}

function getDb() {
  // Dipertahankan supaya kalau ada kode lama yang manggil getDb() tidak langsung crash
  // tanpa pesan yang jelas. Semua controller baru sudah pakai model Mongoose langsung.
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database (MongoDB) belum terkoneksi. Pastikan initDatabase() sudah dipanggil.');
  }
  return mongoose.connection;
}

function closeDatabase() {
  return mongoose.connection.close();
}

module.exports = {
  initDatabase,
  getDb,
  closeDatabase,
  Chat,
  Message,
  Setting,
  Folder
};
