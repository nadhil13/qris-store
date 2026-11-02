# Demo Runbook

## Storefront

1. Jalankan HTTP server sesuai [DEPLOYMENT.md](DEPLOYMENT.md).
2. Buka katalog dan pilih kategori.
3. Cari produk, buka quick view, pilih varian bila tersedia.
4. Tambahkan produk ke keranjang dan ubah jumlah.
5. Isi data pelanggan dan metode pengiriman.

## Checkout

1. Buka checkout.
2. Tinjau total dan metode pembayaran.
3. Buka tampilan QRIS demo.
4. Ingat bahwa konfirmasi pada demo tidak memverifikasi settlement provider.
5. Selesaikan alur demo dan buka pelacak order.

## Admin

Buka `index.html?admin=1`, lalu gunakan kredensial demo yang tercantum di README. Uji overview, order, katalog, storefront, pembayaran, dan tools. Coba edit produk dan cek bahwa perubahan muncul pada katalog browser.

## Realtime antar-tab

Buka dua tab pada origin yang sama. Ubah stok atau produk dari admin pada satu tab, lalu amati tab lain. Uji ini hanya berlaku pada browser dan perangkat yang sama.

## Recovery

Jika state demo rusak, gunakan reset katalog atau bersihkan site data browser. Jangan membersihkan storage pada origin produksi tanpa memahami data yang akan hilang.
