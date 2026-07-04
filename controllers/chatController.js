const axios = require('axios');
const { Chat, Message } = require('../database');

let currentAbortController = null;

function getHFConfig() {
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) {
    throw new Error('API Key belum dikonfigurasi.');
  }
  const baseUrl = (process.env.BASE_URL || 'https://api-inference.huggingface.co').replace(/\/$/, '');
  const model = process.env.MODEL || 'Qwen/Qwen2.5-7B-Instruct';
  return { apiKey, baseUrl, model };
}

// Gabungkan system prompt + history jadi satu prompt teks
// dengan format <|system|>, <|user|>, <|assistant|>
function buildPrompt(systemPrompt, history) {
  let prompt = `<|system|>\n${systemPrompt}\n\n`;

  history.forEach((msg) => {
    if (msg.role === 'user') {
      prompt += `<|user|>\n${msg.content}\n\n`;
    } else if (msg.role === 'assistant') {
      prompt += `<|assistant|>\n${msg.content}\n\n`;
    }
  });

  // tanda supaya model lanjut generate sebagai assistant
  prompt += `<|assistant|>\n`;
  return prompt;
}

// Panggil HuggingFace Inference API pakai axios
async function callHuggingFace(prompt, { temperature, maxTokens, signal }) {
  const { apiKey, baseUrl, model } = getHFConfig();
  const url = `${baseUrl}/models/${model}`;

  let response;
  try {
    response = await axios.post(
      url,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: maxTokens,
          temperature: temperature,
          return_full_text: false
        },
        options: {
          wait_for_model: true
        }
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000,
        signal
      }
    );
  } catch (err) {
    if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
      const abortErr = new Error('Request dibatalkan');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    if (err.response) {
      // HuggingFace balas error (401, 404, 503 model loading, dll)
      const hfError =
        err.response.data?.error ||
        err.response.data?.message ||
        `HuggingFace API error (status ${err.response.status})`;
      throw new Error(hfError);
    }

    if (err.code === 'ECONNABORTED') {
      throw new Error('Request ke HuggingFace timeout (120s). Coba lagi.');
    }

    throw new Error(err.message || 'Gagal menghubungi HuggingFace API');
  }

  const data = response.data;

  // Format umum: [{ generated_text: "..." }]
  if (Array.isArray(data)) {
    const text = data[0]?.generated_text;
    if (typeof text === 'string') return text.trim();
  }

  // Beberapa model balas object langsung
  if (data && typeof data.generated_text === 'string') {
    return data.generated_text.trim();
  }

  if (data && data.error) {
    throw new Error(data.error);
  }

  throw new Error('Format respons dari HuggingFace tidak dikenali.');
}

exports.sendMessage = async (req, res) => {
  try {
    const { message, chatId, temperature, maxTokens, systemPrompt } = req.body;

    console.log('[chat] Request diterima:', { chatId: chatId || null, length: message ? message.length : 0 });

    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, error: 'Pesan tidak boleh kosong' });
    }

    if (!process.env.HF_API_KEY) {
      console.error('[chat] HuggingFace API Missing - HF_API_KEY belum diset di .env');
      return res.status(401).json({ success: false, error: 'API Key belum dikonfigurasi.' });
    }

    let currentChatId = chatId;
    if (!currentChatId) {
      const newChat = await Chat.create({ title: message.slice(0, 50) });
      currentChatId = newChat._id;
    }

    // Save user message
    await Message.create({ chat_id: currentChatId, role: 'user', content: message });

    // Get chat history
    const historyDocs = await Message.find({ chat_id: currentChatId }).sort({ timestamp: 1 }).lean();
    const history = historyDocs.map((doc) => ({ role: doc.role, content: doc.content }));

    const finalSystemPrompt =
      systemPrompt ||
      'Anda adalah DIKZ AI, asisten AI yang ramah, profesional, dan membantu. Anda selalu menjawab dalam bahasa Indonesia kecuali user menggunakan bahasa lain.';

    const prompt = buildPrompt(finalSystemPrompt, history);

    currentAbortController = new AbortController();

    console.log('[chat] Mengirim request ke HuggingFace...');

    const fullResponse = await callHuggingFace(prompt, {
      temperature: parseFloat(temperature) || parseFloat(process.env.TEMPERATURE) || 0.7,
      maxTokens: parseInt(maxTokens) || parseInt(process.env.MAX_TOKENS) || 1024,
      signal: currentAbortController.signal
    });

    console.log('[chat] Response HuggingFace diterima, panjang:', fullResponse.length);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // HuggingFace balas full text sekaligus (bukan token stream),
    // jadi kita kirim sebagai satu event content ke frontend
    res.write(`data: ${JSON.stringify({ content: fullResponse, done: false })}\n\n`);

    // Save assistant message
    await Message.create({ chat_id: currentChatId, role: 'assistant', content: fullResponse });

    // Update chat title if first message
    const chatCount = await Message.countDocuments({ chat_id: currentChatId });

    if (chatCount <= 2) {
      const title = message.slice(0, 50) + (message.length > 50 ? '...' : '');
      await Chat.findByIdAndUpdate(currentChatId, { title });
    } else {
      // findByIdAndUpdate({}) tetap bikin updated_at ke-refresh otomatis (mongoose timestamps)
      await Chat.findByIdAndUpdate(currentChatId, {});
    }

    res.write(`data: ${JSON.stringify({ done: true, chatId: currentChatId.toString() })}\n\n`);
    res.end();
  } catch (error) {
    console.error('[chat] Error:', error.message);

    if (error.name === 'AbortError') {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream');
      }
      res.write(`data: ${JSON.stringify({ error: 'Gagal menghasilkan respons: Request dibatalkan', done: true })}\n\n`);
      res.end();
      return;
    }

    // Kalau header SSE udah kekirim, ga bisa lagi kirim res.status().json()
    // jadi kirim event error via SSE biar frontend ga hang
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message || 'Internal server error', done: true })}\n\n`);
      res.end();
      return;
    }

    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

exports.stopGeneration = async (req, res) => {
  try {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
      res.json({ success: true });
    } else {
      res.json({ success: false, message: 'Tidak ada proses yang berjalan' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.streamMessage = (req, res) => {
  // Lightweight health-check endpoint used by the frontend status indicator.
  res.json({ status: 'ready' });
};

exports.regenerateMessage = async (req, res) => {
  try {
    const { chatId, messageId } = req.body;

    if (!chatId || !messageId) {
      return res.status(400).json({ success: false, error: 'chatId dan messageId diperlukan' });
    }

    // Delete last assistant message
    await Message.deleteOne({ _id: messageId, chat_id: chatId, role: 'assistant' });

    // Get last user message
    const lastUserMsg = await Message.findOne({ chat_id: chatId, role: 'user' })
      .sort({ timestamp: -1 })
      .lean();

    if (!lastUserMsg) {
      return res.status(404).json({ success: false, error: 'Tidak ada pesan user untuk diregenerate' });
    }

    // Resend message
    const reqBody = {
      message: lastUserMsg.content,
      chatId: chatId,
      temperature: req.body.temperature,
      maxTokens: req.body.maxTokens,
      systemPrompt: req.body.systemPrompt
    };

    const newReq = { body: reqBody };
    const newRes = {
      setHeader: (key, value) => res.setHeader(key, value),
      write: (data) => res.write(data),
      end: () => res.end(),
      status: (code) => {
        res.statusCode = code;
        return res;
      },
      json: (data) => res.json(data)
    };

    await exports.sendMessage(newReq, newRes);
  } catch (error) {
    console.error('Regenerate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.copyMessage = (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ success: false, error: 'Content is required' });
  }
  res.json({ success: true });
};
