# Backend Migration Plan

## Current state

State berjalan di browser melalui `localStorage`. BroadcastChannel hanya menyebarkan sinyal antar-tab. Tidak ada server source of truth.

## Stage 1: define contracts

Bekukan bentuk product, order, merchant, payment intent, dan payment event. Tambahkan identifier server dan timestamp dari server. Jangan menerima harga atau status pembayaran dari browser sebagai sumber kebenaran.

## Stage 2: add server persistence

Pindahkan katalog, order, user admin, dan konfigurasi merchant ke database. Buat endpoint dengan validation, authorization, rate limiting, audit log, dan backup.

## Stage 3: migrate browser data

Sediakan export lokal yang disetujui pengguna, validasi di server, tampilkan preview, lalu impor secara idempotent. Jangan mengirim storage secara diam-diam.

## Stage 4: payment verification

Buat payment intent di server, gunakan provider resmi, terima webhook terverifikasi, dan ubah status order hanya dari event server. Payload QRIS di browser bukan pengganti webhook.

## Stage 5: cut over

Tandai localStorage sebagai cache sementara, ukur error, sediakan rollback, lalu hapus jalur demo setelah data server terbukti konsisten.
