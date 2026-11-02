# Future API Direction

Repository ini belum menyediakan API. Bagian ini hanya mencatat boundary yang perlu disepakati sebelum backend dibuat.

## Resource boundaries

- `products`: katalog publik dan perubahan admin.
- `orders`: order yang dibuat pelanggan dan status operasional.
- `payment-intents`: nominal dan provider reference yang dibuat server.
- `payment-events`: webhook provider yang sudah diverifikasi.
- `merchant-settings`: nomor kontak, QRIS, dan konfigurasi toko yang diotorisasi.
- `audit-events`: perubahan admin dan actor.

## Required server rules

Server harus menghitung ulang harga, memeriksa ketersediaan, mengotorisasi admin, membatasi request, memvalidasi webhook, dan menyimpan idempotency key. Browser hanya mengirim intent pengguna, bukan keputusan final pembayaran.

## API documentation policy

Jangan menambahkan URL endpoint, schema response, atau status code sebagai fakta sebelum implementasi backend dan contract test tersedia.
