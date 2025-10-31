# Jokipremium AI API Documentation

## Overview

Jokipremium AI Assistant "Minjo" adalah chatbot AI yang berfungsi sebagai System Analyst dan Customer Service untuk membantu pengguna mendefinisikan kebutuhan aplikasi mereka.

**Model AI:** Google Gemini 2.5 Flash
**Framework:** Express.js
**Deployment:** Vercel Serverless + Traditional Server

---

## Base URL

### Development (Local Server)
```
http://localhost:3000
```

### Production (Vercel)
```
https://your-project.vercel.app
```

---

## API Endpoints

### 1. Health Check

**GET /**

Memeriksa status API dan mendapatkan informasi service.

**Response:**
```json
{
  "ok": true,
  "service": "Jokipremium Assistant",
  "codename": "Minjo",
  "role": "System Analyst + Customer Service",
  "model": "gemini-2.5-flash",
  "sessionStorage": "session/<sessionId>.json",
  "note": "POST /chat { sessionId, question }"
}
```

---

### 2. Chat Endpoint

**POST /chat**

Mengirim pertanyaan ke AI assistant dan mendapatkan respons.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "sessionId": "string (required)",
  "question": "string (required)"
}
```

**Parameters:**
- `sessionId`: Unique identifier untuk session chat (contoh: "user-123", "session-abc")
- `question`: Pertanyaan atau pesan dari user

**Success Response (200 OK):**
```json
{
  "ok": true,
  "answer": "Respons dari AI assistant"
}
```

**Error Responses:**

**400 Bad Request - Missing Request Body:**
```json
{
  "ok": false,
  "error": "invalid_request",
  "detail": "Request body is required"
}
```

**400 Bad Request - Missing Session ID:**
```json
{
  "ok": false,
  "error": "missing_session_id",
  "detail": "sessionId is required"
}
```

**400 Bad Request - Missing Question:**
```json
{
  "ok": false,
  "error": "missing_question",
  "detail": "question is required"
}
```

**400 Bad Request - Blocked Content:**
```json
{
  "ok": false,
  "error": "content_blocked",
  "detail": "Konten tidak dapat diproses karena kebijakan keamanan."
}
```

**429 Too Many Requests:**
```json
{
  "ok": false,
  "error": "rate_limit_exceeded",
  "detail": "Terlalu banyak permintaan. Silakan coba lagi sebentar."
}
```

**500 Internal Server Error - Missing API Key:**
```json
{
  "ok": false,
  "error": "missing_api_key",
  "detail": "Missing GEMINI_API_KEY"
}
```

**500 Internal Server Error - Session Load Failed:**
```json
{
  "ok": false,
  "error": "session_load_failed",
  "detail": "Failed to load session data"
}
```

**502 Bad Gateway - AI Service Error:**
```json
{
  "ok": false,
  "error": "upstream_error",
  "detail": "Gagal mendapatkan respons dari AI. Silakan coba lagi."
}
```

**503 Service Unavailable - Connection Reset:**
```json
{
  "ok": false,
  "error": "upstream_connection_reset",
  "detail": "Koneksi ke layanan AI Google terputus. Coba lagi nanti atau periksa koneksi internet server."
}
```

---

### 3. List Sessions

**GET /sessions**

Mendapatkan daftar semua session yang tersimpan.

**Success Response (200 OK):**
```json
{
  "ok": true,
  "sessions": [
    {
      "sessionId": "user-123",
      "messageCount": 5,
      "done": false,
      "lastRole": "assistant",
      "lastText": "Terima kasih atas informasinya...",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

**Error Response (500 Internal Server Error):**
```json
{
  "ok": false,
  "error": "session_list_failed",
  "detail": "Error message"
}
```

---

### 4. Delete Sessions

**DELETE /sessions**

Menghapus satu atau lebih session berdasarkan sessionId.

**Request Body:**
```json
{
  "sessionIds": ["session-1", "session-2"]
}
```

**Success Response (200 OK):**
```json
{
  "ok": true,
  "deleted": ["session-1", "session-2"],
  "missing": [],
  "errors": []
}
```

**Partial Success Response (207 Multi-Status):**
```json
{
  "ok": false,
  "deleted": ["session-1"],
  "missing": ["session-2"],
  "errors": [
    {
      "sessionId": "session-3",
      "message": "Permission denied"
    }
  ]
}
```

**Error Responses:**

**400 Bad Request - Invalid Payload:**
```json
{
  "ok": false,
  "error": "invalid_payload",
  "detail": "Body must include array field sessionIds."
}
```

**400 Bad Request - Empty Session IDs:**
```json
{
  "ok": false,
  "error": "empty_session_ids",
  "detail": "Provide at least one session id to delete."
}
```

---

## Session Management

### Session Storage

**Local Development:**
- Sessions disimpan di folder `./session/` sebagai file JSON
- Setiap session memiliki file terpisah: `session/<sessionId>.json`

**Vercel Serverless:**
- Sessions disimpan di `/tmp/jokipremium-session/`
- Directory `/tmp` bersifat ephemeral (hilang saat cold start)
- Fallback ke in-memory storage jika filesystem gagal

**Custom Storage Path:**
- Set environment variable `SESSION_DIR` untuk custom path

### Session Data Structure

```json
{
  "history": [
    {
      "role": "user",
      "text": "Saya mau bikin aplikasi kasir",
      "timestamp": "2025-01-15T10:00:00.000Z"
    },
    {
      "role": "assistant",
      "text": "Baik, aplikasi kasir untuk bisnis seperti apa?",
      "timestamp": "2025-01-15T10:00:05.000Z"
    }
  ],
  "done": false
}
```

**Fields:**
- `history`: Array of messages (max 20 messages, auto-trimmed)
- `done`: Boolean flag indicating if conversation is complete

### Session Lifecycle

1. **New Session**: Otomatis dibuat saat pertama kali request dengan sessionId baru
2. **Active Session**: AI akan mengingat konteks percakapan (last 10 messages)
3. **Completed Session**: Session ditandai `done: true` saat AI menyarankan isi form
4. **Reset Session**: User bisa mulai baru dengan mengirim pesan "mulai baru"

---

## Special Features

### 1. Context-Aware Greeting

AI akan menyapa user hanya di:
- First message dalam session
- Setelah reset session dengan "mulai baru"

### 2. Time & Holiday Context

API secara otomatis menyertakan:
- Waktu saat ini (pagi/siang/sore/malam)
- Informasi libur nasional Indonesia (dari API eksternal)

### 3. WhatsApp Template

Jika AI mendeteksi percakapan perlu dilanjutkan ke WhatsApp, akan menyertakan template pesan.

### 4. Auto-complete Session

Session akan otomatis ditandai selesai (`done: true`) jika AI menyarankan user isi form website.

---

## Environment Variables

```env
# Required
GEMINI_API_KEY=your_google_gemini_api_key

# Optional
PORT=3000
SESSION_DIR=/path/to/custom/session/directory
NODE_ENV=production
```

---

## Error Handling

API menggunakan error handling yang comprehensive:

1. **Validasi Input**: Semua request divalidasi sebelum diproses
2. **Graceful Degradation**: Fallback ke in-memory jika filesystem gagal
3. **Atomic Writes**: Session ditulis menggunakan temp file untuk mencegah corruption
4. **Detailed Error Messages**: Error message berbeda untuk development vs production
5. **Retry Mechanism**: AI service error dikategorikan untuk memudahkan retry

---

## Rate Limiting

API tidak memiliki built-in rate limiting. Untuk production, disarankan:
- Implement rate limiting di reverse proxy (nginx, cloudflare)
- Atau gunakan middleware seperti `express-rate-limit`

---

## CORS Policy

API mengizinkan request dari semua origin:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,OPTIONS,PUT,PATCH,DELETE
```

Untuk production, disarankan membatasi origin ke domain spesifik.

---

## Best Practices

### 1. Session ID Management

```javascript
// Good: Use unique identifier per user
const sessionId = `user-${userId}`;

// Better: Include timestamp for multi-device support
const sessionId = `user-${userId}-${deviceId}`;

// Best: Use UUID for complete uniqueness
const sessionId = `${uuidv4()}`;
```

### 2. Error Handling

```javascript
try {
  const response = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, question })
  });

  const data = await response.json();

  if (!data.ok) {
    // Handle specific errors
    switch (data.error) {
      case 'rate_limit_exceeded':
        // Wait and retry
        break;
      case 'upstream_error':
        // Show fallback message
        break;
      default:
        // Show generic error
    }
  }
} catch (error) {
  // Handle network errors
}
```

### 3. Session Cleanup

```javascript
// Cleanup completed sessions periodically
const completedSessions = sessions.filter(s => s.done);
if (completedSessions.length > 0) {
  await fetch('/sessions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionIds: completedSessions.map(s => s.sessionId)
    })
  });
}
```

---

## Deployment

### Vercel Serverless

1. Push code ke Git repository
2. Connect repository ke Vercel
3. Add environment variable `GEMINI_API_KEY`
4. Deploy

**Configuration:**
```json
// vercel.json
{
  "functions": {
    "api/index.js": {
      "runtime": "@vercel/node@5.5.2",
      "memory": 512,
      "maxDuration": 15,
      "includeFiles": "src/**"
    }
  }
}
```

### Traditional Server

```bash
# Install dependencies
npm install

# Set environment variables
export GEMINI_API_KEY=your_key
export PORT=3000

# Start server
npm start

# Or development mode
npm run dev
```

---

## Testing

### Test Chat Endpoint

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-123",
    "question": "Saya mau bikin aplikasi kasir sederhana"
  }'
```

### Test List Sessions

```bash
curl http://localhost:3000/sessions
```

### Test Delete Sessions

```bash
curl -X DELETE http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "sessionIds": ["test-123"]
  }'
```

---

## Troubleshooting

### Issue: Session tidak tersimpan di Vercel

**Cause:** Vercel serverless menggunakan `/tmp` yang ephemeral

**Solution:**
- Normal behavior untuk serverless
- Fallback ke in-memory storage otomatis aktif
- Untuk persistent storage, gunakan database eksternal (Redis, MongoDB, dll)

### Issue: AI response timeout

**Cause:** Gemini API lambat atau network issue

**Solution:**
- Check Vercel function timeout (max 15s untuk free tier)
- Implement retry mechanism di client
- Consider using streaming response

### Issue: CORS error di browser

**Cause:** Browser blocking request dari domain berbeda

**Solution:**
- Sudah di-handle dengan `Access-Control-Allow-Origin: *`
- Jika masih error, check browser console untuk detail
- Pastikan preflight OPTIONS request berhasil

---

## Support

Untuk issue atau pertanyaan, silakan hubungi tim Jokipremium melalui WhatsApp admin.

---

**Last Updated:** 2025-01-15
**API Version:** 1.0.0
**Maintained by:** Jokipremium Team
