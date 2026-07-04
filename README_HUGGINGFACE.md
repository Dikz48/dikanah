# DIKZ AI — HuggingFace Inference API + MongoDB

Project ini sudah di-switch:
- Provider AI: Groq/OpenAI → **HuggingFace Inference API**
- Database: SQLite → **MongoDB (Atlas)**

Frontend TIDAK diubah tampilannya, semua tetap jalan lewat `/api/chat/send`.

## Cara Test (3 langkah)

1. Buka file `.env` (atau `ENV_SETUP.txt` kalau `.env` gak keliatan di HP), isi 2 hal ini:
   ```
   HF_API_KEY=hf_xxxxxxxxxx
   MONGODB_URI=mongodb+srv://Handika25:PASSWORD_ASLI_KAMU@cluster0.yyzu9xj.mongodb.net/dikzai?appName=Cluster0
   ```
   - `HF_API_KEY` -> ambil di https://huggingface.co/settings/tokens
   - `MONGODB_URI` -> ganti `PASSWORD_ASLI_KAMU` dengan password database Atlas kamu yang
     beneran (bagian `<db_password>` di connection string Atlas emang harus diganti manual,
     bukan otomatis kesubstitusi). Saya juga nambahin `/dikzai` sebelum tanda `?` sebagai nama
     database - kalau gak dikasih nama, Mongo bakal otomatis pakai database bernama `test`.

2. Install dependency:
   ```
   npm install
   ```

3. Jalankan server:
   ```
   npm start
   ```

Buka `http://localhost:3000`, langsung bisa chat, history-nya kesimpen di MongoDB.

## File yang Berubah

| File | Perubahan |
|---|---|
| `controllers/chatController.js` | Call ke HuggingFace pakai `axios`, simpan pesan ke MongoDB (Mongoose) |
| `controllers/settingsController.js` | Setting disimpan/diambil dari koleksi MongoDB, cek `HF_API_KEY` |
| `controllers/historyController.js` | Full rewrite - semua query SQL diganti query Mongoose (model `Chat` & `Message`) |
| `database.js` | Full rewrite - dari `sqlite3` ke `mongoose`, connect ke MongoDB Atlas |
| `server.js` | Cek `HF_API_KEY` bukan `OPENAI_API_KEY` |
| `.env` / `.env.example` | Tambah `MONGODB_URI`, config HuggingFace |
| `package.json` | `sqlite3` -> `mongoose`, `openai` -> `axios` |
| `public/js/chat.js`, `public/js/history.js` | ID chat sekarang dikasih tanda kutip di `onclick` (`selectChat('${chat.id}')`), karena ID MongoDB itu string panjang (contoh: `65f2a1b2c3d4e5f6a7b8c9d0`), bukan angka kayak SQLite. Tanpa kutip, tombol pin/rename/delete/buka chat bakal error di browser. |
| `routes/*`, `middleware/*` | **Tidak diubah** |

## Kalau Ada Error

- **"MONGODB_URI belum diset di .env"** -> isi dulu `MONGODB_URI` di `.env`.
- **"MongooseServerSelectionError" / connection timeout** -> cek 3 hal:
  1. Password di connection string masih placeholder -> ganti dengan password asli akun database Atlas kamu.
  2. IP kamu belum di-whitelist di MongoDB Atlas -> buka Atlas dashboard -> **Network Access** -> **Add IP Address** -> pilih **Allow Access from Anywhere** (`0.0.0.0/0`) kalau lagi testing.
  3. Username di connection string (`Handika25`) harus sama persis dengan user database yang kamu bikin di Atlas.
- **"API Key belum dikonfigurasi"** -> `HF_API_KEY` di `.env` masih kosong/placeholder.
- **Error 503 dari HuggingFace** -> model lagi loading di server HF, kirim ulang pesan setelah beberapa detik (sistem udah pakai `wait_for_model: true` jadi nunggu otomatis).
- **Model diganti** -> tinggal ubah `MODEL=` di `.env`, gak perlu ubah kode.

## Kalau Buka Zip Lewat HP (file `.env` gak kelihatan)

File `.env` itu "hidden file" (nama diawali titik), banyak file manager HP
nyembunyiin dia otomatis. Ada file kembarannya di `ENV_SETUP.txt` (isi sama persis,
cuma namanya gak diawali titik jadi keliatan normal). Caranya:

1. Buka `ENV_SETUP.txt` pakai text editor apa aja di HP
2. Edit `HF_API_KEY` dan `MONGODB_URI` sesuai punya kamu
3. Save
4. Rename file itu jadi `.env` (pakai app **ZArchiver** atau **Files by Google** - tap-hold file -> Rename)
5. Kalau mau jalanin project-nya langsung dari HP, pakai **Termux** - di Termux file `.env`
   bisa diedit langsung pakai `nano .env`, gak perlu rename-rename.

**Catatan penting:** project ini (Express.js server) harus dijalanin pakai Node.js - bisa dari
laptop/PC/VPS, atau dari HP pakai **Termux**. Gak bisa langsung dibuka kayak file biasa tanpa dijalanin.

## Catatan Teknis

- HuggingFace Inference API balas teks **penuh sekaligus** (bukan token-per-token kayak
  OpenAI/Groq streaming). Backend tetap kirim ke frontend dalam format SSE
  (`data: {...}\n\n`) biar kompatibel sama `chat.js` yang udah ada - cuma isinya
  satu event `content` besar, lalu langsung ditutup `done:true`.
- ID chat & message sekarang pakai MongoDB ObjectId (string 24 karakter), bukan angka urut
  kayak SQLite. Ini udah disesuaikan di semua controller dan 2 file frontend yang butuh.
