# Security Policy

## Status keamanan

Atelier Nusantara saat ini adalah frontend statis dan belum dirancang sebagai sistem produksi. Kredensial admin demo berada di client code, data operasional berada di `localStorage`, dan pembayaran belum memiliki webhook settlement server.

## Versi yang didukung

| Versi | Dukungan |
|---|---|
| `main` | Perbaikan keamanan dokumentasi dan kode akan dipertimbangkan |

## Melaporkan kerentanan

Jangan membuka issue publik untuk kredensial, token, data pelanggan, kelemahan pembayaran, atau exploit yang dapat digunakan.

Laporkan secara privat kepada pemilik repository melalui kanal kontak GitHub yang tersedia pada profil repository. Sertakan:

- Ringkasan dampak.
- Langkah reproduksi minimal.
- Browser dan versi sistem operasi.
- URL atau file yang terpengaruh.
- Bukti konsep yang tidak berisi secret nyata.

Kami akan mengonfirmasi penerimaan laporan, menilai dampaknya, dan memberi kabar setelah perbaikan atau mitigasi tersedia. Jangan menguji terhadap akun, merchant, atau data pihak lain tanpa izin.

## Jika secret terlanjur terpublikasi

Segera cabut atau rotasi secret di provider terkait, lalu laporkan commit dan file yang terpengaruh secara privat. Menghapus file pada commit terbaru tidak menghapusnya dari riwayat Git.
