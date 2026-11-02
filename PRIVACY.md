# Privacy Notice

## Current implementation

Atelier Nusantara saat ini memproses data terutama di browser. Keranjang, data checkout, order demo, konfigurasi toko, dan produk custom dapat tersimpan di `localStorage` pada perangkat pengguna.

Jika pengguna memilih WhatsApp, browser membuka link ke layanan WhatsApp dan data ringkasan order dapat terlihat oleh layanan tersebut. Kebijakan WhatsApp berlaku terpisah dari repository ini.

## What is not provided

Repository ini belum menyediakan akun server, data retention policy terpusat, consent management, server audit log, atau penghapusan data jarak jauh. QRIS pada demo juga belum memberikan bukti settlement.

## Before public launch

Pemilik deployment perlu menetapkan controller data, tujuan pemrosesan, periode penyimpanan, prosedur penghapusan, kontak privasi, analytics policy, cookie policy, dan pemrosesan payment provider sesuai yurisdiksi yang berlaku.

Jangan memasukkan data pelanggan nyata, kredensial, token, atau payload merchant privat ke issue dan pull request publik.
