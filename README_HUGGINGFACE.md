# DIKZ AI — Sudah Pindah ke HuggingFace Inference API

Project ini sudah di-switch dari Groq/OpenAI ke HuggingFace Inference API.
Frontend TIDAK diubah sama sekali, semua tetap jalan lewat `/api/chat/send`.

## Cara Test (3 langkah)

1. Buka file `.env` (sudah disiapkan di root folder ini), ganti baris:
   ```
   HF_API_KEY=hf_your_huggingface_api_key_here
   ```
   dengan API key HuggingFace kamu. Ambil di:
   https://huggingface.co/settings/tokens
   (bikin token baru dengan permission minimal "Read")

2. Install dependency:
   ```
   npm install
   ```

3. Jalankan server:
   ```
   npm start
   ```
   atau untuk mode dev (auto-restart):
   ```
   npm run dev
   ```

Buka browser ke `http://localhost:3000`, langsung bisa chat.

## File yang Berubah dari Versi Lama

| File | Perubahan |
|---|---|
| `controllers/chatController.js` | Full rewrite — pakai `axios` ke HuggingFace, bukan `openai` SDK lagi |
| `controllers/settingsController.js` | Cek `HF_API_KEY` bukan `OPENAI_API_KEY` |
| `server.js` | Cek `HF_API_KEY` bukan `OPENAI_API_KEY`, log model default HF |
| `.env` / `.env.example` | Konfigurasi HuggingFace |
| `package.json` | Dependency `openai` diganti `axios` |
| `routes/chat.js` | **Tidak diubah** — cuma router tipis, logic-nya di controller |
| `public/*` | **Tidak diubah** — frontend sudah kompatibel dari awal |

## Kalau Buka Zip Lewat HP (file `.env` gak kelihatan)

File `.env` itu "hidden file" (nama diawali titik), banyak file manager HP
nyembunyiin dia otomatis. Ada file kembarannya di `ENV_SETUP.txt` (isi sama persis,
cuma namanya gak diawali titik jadi keliatan normal). Caranya:

1. Buka `ENV_SETUP.txt` pakai text editor apa aja di HP
2. Edit baris `HF_API_KEY=hf_your_huggingface_api_key_here` jadi API key kamu
3. Save
4. Rename file itu jadi `.env` (paling gampang pakai app **ZArchiver** atau **Files by Google** — tap-hold file → Rename → hapus `ENV_SETUP.txt` ganti jadi `.env`)
5. Kalau HP kamu gak mau nyimpen file tanpa nama depan (cuma ekstensi), taruh project ini ke laptop/PC dulu buat jalanin `npm start` — Node.js server emang harus dijalanin dari komputer, bukan dari HP langsung

**Catatan penting:** project ini (Express.js server) HARUS dijalanin di laptop/PC/VPS pakai Node.js —
gak bisa langsung jalan cuma dari HP. HP cuma buat edit/liat file aja. Kalau belum ada laptop,
kamu bisa juga pakai layanan online kayak Replit atau Railway buat upload & jalanin project ini dari HP.

## Kalau Ada Error

- **"API Key belum dikonfigurasi"** → `HF_API_KEY` di `.env` masih kosong/placeholder, isi dulu.
- **Respons lambat / timeout** → model gratis HuggingFace kadang perlu "wake up" dulu (cold start), sistem sudah pakai `wait_for_model: true` jadi otomatis nunggu, tapi bisa sampai ±20-30 detik di percobaan pertama.
- **Error 503 dari HuggingFace** → model lagi loading di server HF, coba kirim ulang pesan setelah beberapa detik.
- **Model diganti** → tinggal ubah `MODEL=` di `.env`, tidak perlu ubah kode.

## Catatan Teknis

HuggingFace Inference API (endpoint `text-generation`) balas teks **penuh sekaligus**,
bukan token-per-token seperti OpenAI/Groq streaming. Backend tetap mengirim ke frontend
dalam format SSE (`data: {...}\n\n`) supaya kompatibel dengan kode `chat.js` yang sudah ada —
cuma isinya satu event `content` besar, lalu langsung ditutup dengan `done:true`.
