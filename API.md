# API

Handler Node tersedia di `api/`; preview memakai `server.js`. Respons inventori tidak boleh dicache. Lihat `DEPLOYMENT.md` untuk environment, bootstrap katalog, dan batas operasional.

## Inventori transaksional — `/api/inventory`

Semua operasi membutuhkan Redis REST. Kegagalan storage memberi 503, tanpa fallback memori.

### GET

- Default atau `action=stock`: snapshot publik `{ok, stock: {revision, products, serverTime}}`. `products` memetakan ID ke stok tersedia; `null` berarti tidak terbatas.
- `action=order&id=…&capability=…`: satu order dengan kapabilitas pelanggan; kapabilitas salah memberi 404. Jangan membagikan URL kapabilitas atau mencatatnya pada analytics.
- `action=list`: membutuhkan Bearer admin token; maksimum 200 order terbaru.

### POST

JSON dibatasi 64 KB. Klien tidak boleh mengirim harga atau total.

- `reserve`: `id`, `capability`, `items`, `customer`, `shippingId`, `voucherCode`, `paymentMethod`. Item berisi `productId`, `variant`, `qty`, `note`; customer berisi `name`, `phone`, `address`. Metode `qris` atau `whatsapp`. ID dan kapabilitas dibuat kriptografis oleh klien dan dipersist sebelum request. Kuantitas integer 1–99, maksimum 100 baris, agregat per produk maksimum 99. Server membaca harga/varian dari katalog, menghitung total dan deadline 10 menit dari Redis TIME, lalu menyimpan hold serta pengurangan stok dalam satu Lua EVAL.
- Retry `reserve` harus memakai ID, kapabilitas, dan input yang sama. Perubahan input pada ID sama memberi 409 `IDEMPOTENCY_CONFLICT`. Jangan membuat ID baru setelah timeout ambigu.
- `confirm`: `id`, `reference` opsional; membutuhkan admin.
- `cancel`: `id`, `note` opsional; membutuhkan admin. Mengembalikan stok satu kali; order completed/expired tidak dapat dibatalkan.
- `advance`: `id`, `expectedStatus` (`paid`, `processing`, atau `ready`); membutuhkan admin. Urutan berikutnya adalah processing, ready, completed.
- `adjust`: `productId`, `stock` (integer nonnegatif atau null), `expectedRevision`; membutuhkan admin. Mengubah stok *tersedia*, bukan total termasuk hold. Konflik revisi memberi 409; refresh dan minta keputusan admin lagi, jangan retry mutasi otomatis. Perubahan mode terbatas/tidak terbatas ditolak selama ada order aktif terkait.

Admin memakai `Authorization: Bearer <INVENTORY_ADMIN_TOKEN>`. Secret tidak dikirim melalui query atau disimpan browser secara permanen. Token salah memberi 401; secret server belum disetel memberi 503. Respons berhasil menyertakan `ok: true`, snapshot `stock`, dan `order`/`orders` sesuai operasi. Error memiliki `ok: false` dan `code`; kapasitas/backlog/storage dapat memberi 503. Konfirmasi pembayaran masih manual, bukan bukti settlement provider.

## Settings — `/api/settings`

GET publik membaca settings dan katalog kanonis. POST menggabungkan versi settings (`updatedAt`) dan katalog (`catalogUpdatedAt`, `products`) secara terpisah melalui Lua. Di produksi POST memerlukan Bearer admin token. Publish katalog tidak mengubah counter inventori yang sudah diinisialisasi. Tanpa KV, produksi memberi 503; mode memori hanya untuk pengembangan endpoint legacy ini.

## Legacy orders — `/api/orders`

Di produksi GET memerlukan admin; POST selalu ditolak 409 `LEGACY_ORDER_WRITES_DISABLED`. Jalur ini tidak mengubah inventori. Order lama memerlukan rekonsiliasi migrasi dan tidak otomatis menjadi hold.

## Belum tersedia

Webhook pembayaran terverifikasi, rate limiter aplikasi, arsip inventori otomatis, akun admin per pengguna, dan audit actor individual belum diimplementasikan. Terapkan pembatasan edge dan prosedur operasional sebelum publikasi.
