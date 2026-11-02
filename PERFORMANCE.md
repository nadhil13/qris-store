# Performance Notes

## Current mechanisms

- Vendor GSAP dan QR library dibundel lokal untuk mengurangi ketergantungan runtime pada CDN.
- Service worker mencache aset statis setelah instalasi.
- Hero image memiliki dimensi dan prioritas loading.
- Motion memakai GSAP dengan fallback reduced motion.
- CSS responsive mencegah layout melebar pada mobile.

## Practical checks

Uji first load dan reload cached pada HTTP server. Perhatikan console error, ukuran gambar, layout shift, dan waktu sampai katalog dapat digunakan. Jangan menuliskan skor Lighthouse atau angka Web Vitals tanpa pengukuran nyata.

## Future work

Optimasi berikutnya dapat mencakup kompresi aset, responsive image variants, lazy loading gambar di bawah fold, pemecahan module, dan pengukuran field melalui tool yang disetujui. Setiap optimasi harus mempertahankan alt text dan ruang layout.
