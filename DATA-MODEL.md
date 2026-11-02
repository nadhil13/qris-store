# Data Model

Dokumen ini menggambarkan bentuk data yang digunakan frontend saat ini. Field dapat bertambah karena aplikasi masih berupa demo statis.

## Product

| Field | Bentuk | Keterangan |
|---|---|---|
| `id` | string | Identitas produk pada katalog browser |
| `name` | string | Nama yang tampil ke pelanggan |
| `category` | string | Kategori katalog |
| `price` | number | Harga dalam IDR |
| `tags` | string[] | Label editorial atau produk |
| `desc` | string | Deskripsi singkat |
| `story` | string | Narasi produk, dapat berupa demo |
| `image` | string | URL gambar atau aset |
| `isAvailable` | boolean | Status tersedia atau habis |
| `variants` | object | Judul dan pilihan varian, bila ada |

## Customer

`name`, `phone`, dan `address` berasal dari form checkout. Data ini tersimpan lokal sesuai alur demo dan dapat diteruskan ke WhatsApp saat pengguna memilih aksi tersebut.

## Order

Order menyimpan `invoice`, `date`, `customer`, `shipping`, `items`, `amount`, `paymentMethod`, `statusStep`, dan `statusLabel`. Status pada demo bukan bukti settlement provider.

## Store configuration

Konfigurasi toko berisi `merchantWhatsApp`, `shippingMethod`, dan data `customer` terakhir. Nilai ini disimpan lokal.

## QRIS configuration

Konfigurasi QRIS berisi mode merchant dan string payload statis. Gambar QRIS hanya menjadi aset visual jika payload tidak dapat diekstrak dan divalidasi.

## Future backend mapping

Backend sebaiknya memisahkan merchant, user admin, product, order, payment intent, payment event, dan audit event. Jangan memindahkan nilai dari `localStorage` ke database tanpa validasi server dan migrasi yang eksplisit.
