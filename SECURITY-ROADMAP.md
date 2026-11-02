# Security Roadmap

## Current risks

- Kredensial admin demo berada di client code.
- Data order dan katalog berada di localStorage.
- QRIS belum terhubung ke settlement webhook.
- Tidak ada authorization server atau audit log.
- Aset dan link eksternal mengikuti kebijakan pihak ketiga.

## Before public production

1. Tambahkan server authentication dan session management.
2. Hapus credential hardcoded dari frontend.
3. Pindahkan harga, stok, order, dan QRIS config ke server.
4. Validasi webhook provider dan idempotency.
5. Tambahkan authorization per role dan audit log.
6. Terapkan secret management, HTTPS, backup, monitoring, dan rate limiting.
7. Lakukan threat modeling dan security review independen.

## Reporting

Gunakan [SECURITY.md](SECURITY.md) untuk laporan privat. Jangan menguji merchant atau provider nyata tanpa izin.
