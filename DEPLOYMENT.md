# Deployment Guide

Storefront memakai aset statis dan handler Node di `api/`. Hosting statis saja tidak mendukung checkout atau admin inventori. Gunakan hosting dengan handler tersebut, misalnya Vercel, atau adaptor server yang setara. Preview lokal memakai `node server.js`, bukan server file Python.

## Environment server

Konfigurasikan secara privat di dashboard hosting:

- `KV_REST_API_URL` dan `KV_REST_API_TOKEN`, atau `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN`.
- `INVENTORY_ADMIN_TOKEN`: secret acak kuat untuk akses admin. Jangan taruh dalam HTML, JavaScript publik, Git, atau chat.
- `NODE_ENV=production` untuk server produksi selain Vercel. `VERCEL_ENV=production` juga mengaktifkan pengamanan produksi.

Produksi tanpa KV menolak request settings/orders dengan 503, tidak memakai memori proses. Inventori selalu membutuhkan KV, termasuk lokal. Token dimasukkan pada form admin dan hanya disimpan dalam memori halaman; reload memerlukan login ulang. Semua akses publik harus memakai HTTPS.

## Bootstrap dan migrasi

1. Cadangkan `atelier_settings` dan order lama sebelum rollout. Jangan menghapus `atelier_inventory_v1` untuk mengubah stok.
2. Sebelum login admin pertama, publikasikan katalog tepercaya ke `POST /api/settings` melalui klien HTTP privat dengan Bearer admin token. Payload katalog mengikuti `products` dan `catalogUpdatedAt` pada kontrak settings; lihat `api/settings.js`. Katalog browser tidak otomatis menjadi sumber tepercaya. Tanpa katalog server, inventori menolak operasi dengan `CATALOG_UNAVAILABLE`.
3. Pada akses inventori pertama, stok awal diambil sekali dari katalog server. Rekonsiliasikan pembelian/order lama terlebih dahulu: order legacy tidak otomatis diimpor sebagai reservasi atau dikurangi dari stok.
4. Masuk admin dan periksa stok. Setelah inisialisasi, perubahan katalog tidak mengatur ulang stok. Gunakan kontrol stok admin yang melakukan `adjust` dengan revisi snapshot. Produk baru harus diinisialisasi melalui operasi ini; stok yang belum diinisialisasi tidak dapat dibeli.
5. Uji dua checkout bersamaan dengan stok terbatas pada deployment staging, expiry, pembatalan, dan konfirmasi admin. Jangan memakai data pelanggan nyata untuk smoke test.

Setiap lingkungan yang memakai KV, termasuk development dan preview, menolak penulisan `/api/orders` legacy dengan 409. Pembacaan legacy dan perubahan settings memerlukan token admin. Mode development tanpa KV tetap dapat memakai memori untuk demo legacy; jangan hubungkan preview ke database produksi. Order inventori memakai endpoint terpisah. Pertahankan cadangan dan proses operasional untuk pesanan lama selama migrasi.

Serializer baru mencegah kerusakan state oleh nama ID, tetapi tidak memperbaiki record yang sudah rusak. Jika instalasi lama mengembalikan `INVENTORY_STATE_INVALID`, hentikan checkout, cadangkan kedua key, lalu rekonsiliasikan stok, hold, dan pesanan dari sumber tepercaya sebelum pemulihan terkontrol. Jangan menghapus key inventori atau menginisialisasi ulang stok secara membabi buta.

Pesanan baru menyimpan snapshot payload QRIS server. Perubahan QRIS merchant tidak mengubah instruksi pembayaran pesanan tersebut. Pesanan lama dengan snapshot kosong tidak diisi otomatis menggunakan QRIS terbaru; pelanggan mendapat pesan untuk menghubungi toko agar instruksi direkonsiliasi.

## Reservasi dan pembayaran

Checkout QRIS maupun WhatsApp menahan stok selama 10 menit berdasarkan waktu Redis. Harga, varian, ongkir, voucher, dan total dihitung server. Biaya server saat ini ditetapkan dalam `api/inventory.js`; perubahan konfigurasi komersial harus diselaraskan di server, bukan hanya browser.

Konfirmasi pembayaran oleh admin mengonsumsi reservasi tanpa pengurangan kedua. Pembatalan mengembalikan stok satu kali. Hold kedaluwarsa dikembalikan saat akses inventori berikutnya, maksimum 128 per panggilan; backlog dapat memberi 503 `RECLAIM_REQUIRED` dan perlu request ulang. Tidak ada janji pengembalian tepat pada detik expiry tanpa trafik.

Settlement masih manual; belum ada webhook provider yang membuktikan dana diterima. Jangan mengonfirmasi hanya berdasarkan QR yang ditampilkan atau status lokal pelanggan.

State inventori memiliki batas 5.000 catatan. Daftar admin menampilkan 200 terbaru, tetapi hold tidak dipangkas bersama daftar. Siapkan pemantauan kapasitas dan prosedur arsip yang diaudit sebelum batas tercapai; saat ini belum ada arsip otomatis. Batasi trafik checkout di edge karena endpoint publik tidak memiliki rate limiter aplikasi.

## Verifikasi

`tests/run-inventory-redis.mjs` menjalankan Redis lokal terisolasi dan bridge REST loopback, tanpa persistence. Atur `INVENTORY_TEST_REDIS_SERVER` ke executable Redis tepercaya jika tidak memakai lokasi default sementara Windows. Alternatifnya, jalankan tes API dengan `INVENTORY_TEST_REDIS_URL` dan `INVENTORY_TEST_REDIS_TOKEN` pada Redis REST khusus tes. Kunci pengujian memakai namespace acak dan dibersihkan; jangan gunakan database produksi.

Lua telah diuji pada Redis nyata versi 5.0.14.1: konkurensi, retry idempoten, expiry, transisi, CAS, total kanonis, dan array kosong. Ini bukan verifikasi koneksi Upstash atau deployment pengguna. Ulangi tes pada staging dengan runtime/layanan target dan periksa backup, batas request, serta latensi.

## Cache dan rollout

Server Node hanya menyajikan entry storefront/PWA dan aset dalam direktori publik yang diizinkan; source backend, Git, dokumen internal, dan tes tidak tersedia lewat HTTP. Request API pada adaptor Node dibatasi 64 KiB sebelum parsing JSON. Pastikan reverse proxy/hosting juga menerapkan batas body dan trafik yang sesuai.

Daftar pesanan admin disimpan dalam memori halaman dan dibersihkan saat logout. Penyimpanan pembeli dipisahkan berdasarkan ID milik pembeli atau kapabilitas reservasi. Migrasi browser membuang salinan pesanan lain yang tersisa dari dashboard lama; ini bukan penghapusan data pada backend.

Naikkan `CACHE_NAME` pada `sw.js` saat aset berubah. Modul inventori/auth ikut precache, tetapi seluruh `/api/` selalu melewati cache. Offline hanya mendukung tampilan aset; checkout baru tidak dapat berhasil tanpa server. Uji reload pertama dan setelah service worker aktif.

Repository tidak mengatur secret, domain, provider settlement, atau deployment publik secara otomatis.
