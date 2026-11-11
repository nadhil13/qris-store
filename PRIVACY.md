# Pemberitahuan Privasi

Dokumen ini menjelaskan data apa yang disimpan kode di repository ini dan di mana. Ringkasannya juga tampil untuk pembeli di bagian "Privasi data pesanan" (`#privasi`) di footer, dan ditautkan dari form checkout.

## Data yang disimpan di server

Jika deployment memasang `KV_REST_API_URL`/`KV_REST_API_TOKEN` (Vercel KV) atau `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (Upstash Redis), endpoint `api/inventory.js` dan `api/orders.js` menyimpan setiap pesanan di Redis. Satu pesanan berisi:

- Nama pemesan, nomor WhatsApp, dan alamat atau catatan lokasi.
- Isi keranjang, varian, kode voucher, metode pengiriman, dan total tagihan.
- Metode pembayaran, payload QRIS, waktu pembayaran dikonfirmasi, dan riwayat status (timeline).
- Reservasi stok. Stok ditahan 10 menit (`expiresAt = now + 600000` di `api/lib/inventory-script.js`). Pesanan yang tidak dibayar dalam batas itu diubah ke status `expired` dan stoknya dikembalikan.

Kode belum menghapus pesanan yang sudah selesai, dibatalkan, atau kedaluwarsa. Data tetap ada di Redis sampai pemilik deployment menghapusnya. `api/settings.js` menyimpan pengaturan toko (bukan data pembeli) di Redis yang sama.

Panel penjual membaca dan mengubah data ini dengan `INVENTORY_ADMIN_TOKEN`. Token yang diketik penjual hanya disimpan di memori tab (`scripts/core/auth.js`), tidak di `localStorage`, dan hilang saat tab ditutup atau penjual keluar.

## Data yang disimpan di browser pembeli

`scripts/core/store.js` menulis key berikut ke `localStorage` perangkat pembeli:

| Key | Isi |
| --- | --- |
| `an.cart.v3` | Isi keranjang |
| `an.my-orders.v3` | Daftar pesanan milik pembeli ini, termasuk data checkout |
| `an.prefs.v3` | Preferensi tampilan |
| `an.settings.v3` | Salinan pengaturan toko |
| `an.products.v3`, `an.products.version.v3` | Salinan katalog |
| `an.orders.v3` | Detail pesanan milik pembeli ini (pesanan lain disaring keluar) |
| `an.inventory.reservations.v1` | Reservasi stok yang sedang menunggu pembayaran, agar bisa dilanjutkan setelah halaman dimuat ulang |

Daftar pesanan semua pembeli yang dibuka di panel penjual hanya disimpan di memori tab dan dihapus saat penjual keluar.

Pembeli dapat menghapus semuanya lewat pengaturan browser (hapus data situs).

## WhatsApp

Jika pembeli memilih pesan lewat WhatsApp, browser membuka link `wa.me` berisi ringkasan pesanan, nama, nomor, dan alamat. Setelah itu data berada di layanan WhatsApp dan tunduk pada kebijakan WhatsApp, terpisah dari repository ini.

## Yang belum disediakan

- Kebijakan retensi dan penghapusan otomatis di server.
- Formulir permintaan akses atau penghapusan data. Saat ini pembeli diarahkan menghubungi penjual lewat WhatsApp toko.
- Consent management, cookie banner, dan audit log server.
- Bukti settlement QRIS dari payment provider. Status "dibayar" dikonfirmasi manual oleh penjual.

## Sebelum diluncurkan untuk publik

Pemilik deployment perlu menetapkan controller data, tujuan pemrosesan, periode penyimpanan, prosedur penghapusan, kontak privasi, analytics policy, cookie policy, dan pemrosesan payment provider sesuai yurisdiksi yang berlaku.

Jangan memasukkan data pelanggan nyata, kredensial, token, atau payload merchant privat ke issue dan pull request publik.
