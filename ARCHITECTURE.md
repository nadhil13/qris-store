# Architecture

## Scope

Atelier Nusantara adalah aplikasi web statis. Browser memuat `index.html`, stylesheet, module JavaScript, library vendor, dan service worker. Tidak ada server aplikasi di repository ini.

## Runtime flow

1. Browser membuka `index.html` melalui HTTP.
2. `scripts/app.js` memuat katalog default, membaca state browser, lalu merender storefront.
3. Pengguna menambah produk ke keranjang dan mengisi data checkout.
4. `scripts/qris.js` memproses payload QRIS di browser untuk kebutuhan demo.
5. Pesanan demo disimpan ke `localStorage` dan dapat dilihat dari workspace admin.
6. Tab lain menerima perubahan melalui `BroadcastChannel`, dengan event `storage` sebagai fallback.

## Boundaries

- `index.html` berisi markup storefront, modal checkout, dan shell admin.
- `styles/main.css` berisi token visual, responsive layout, focus state, dan motion fallback.
- `scripts/app.js` mengelola state, katalog, keranjang, checkout, admin, dan sinkronisasi browser.
- `scripts/qris.js` mengelola parsing, konversi, CRC16, dan rendering QRIS.
- `sw.js` mengelola cache aset statis. Cache bukan database.
- `scripts/vendor/` berisi library yang dibundel dan memiliki notice terpisah.

## State and persistence

State utama berada pada object browser di `scripts/app.js`. Data yang bertahan antar reload memakai `localStorage`, termasuk keranjang, order aktif, order admin, konfigurasi QRIS, konfigurasi toko, produk custom, dan sesi admin demo.

Data tersebut hanya berlaku pada origin dan browser yang menyimpannya. Membersihkan storage dapat menghapus data. Aplikasi tidak memiliki conflict resolution, audit log, multi-user access, atau backup server.

## Realtime browser

Channel `atelier-nusantara-admin` mengirim domain `orders`, `products`, atau `store`. Pesan hanya menjadi sinyal untuk membaca ulang state dari storage. BroadcastChannel tidak mengirimkan data lintas perangkat dan tidak menggantikan database.

## QRIS boundary

Browser dapat memvalidasi payload EMVCo yang tersedia, mengganti mode statis ke dinamis, mengisi nominal, dan menghitung CRC16. Proses tersebut hanya menghasilkan payload. Provider pembayaran atau backend merchant tetap diperlukan untuk settlement dan verifikasi transaksi.
