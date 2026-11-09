// Demo catalog. Replace through the admin dashboard (Produk) or edit this seed.
// Variant "delta" is added to the base price; stock null means unlimited.
export const PRODUCTS = [
  {
    "id": "prod-01",
    "name": "Wagyu Se’i Sapi Asap",
    "category": "makanan",
    "price": 78000,
    "tags": [
      "Best Seller",
      "Signature"
    ],
    "desc": "Daging wagyu meltique diasap perlahan dengan kayu kosambi 12 jam, disajikan bersama sambal lu’at kecombrang dan tumis daun pepaya organik.",
    "story": "Terinspirasi tradisi se’i Rote dan Kupang, menggunakan kayu kosambi liar NTT beraroma manis alami yang mengunci kelembutan serat marbling wagyu.",
    "image": "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80",
    "spec": "480 kkal",
    "origin": "Kupang x Wagyu Australia",
    "variantTitle": "Tingkat Kepedasan Sambal Lu’at",
    "variants": [
      {
        "label": "Level 0: Ramah Anak",
        "delta": 0
      },
      {
        "label": "Level 1: Sedang Nikmat",
        "delta": 0
      },
      {
        "label": "Level 2: Pedas Nampol",
        "delta": 0
      },
      {
        "label": "Level 3: Ekstra Kecombrang",
        "delta": 0
      }
    ],
    "stock": 24,
    "isAvailable": true,
    "featured": true,
    "sortOrder": 0
  },
  {
    "id": "prod-02",
    "name": "Truffle Mushroom Sourdough",
    "category": "makanan",
    "price": 54000,
    "tags": [
      "Artisan Bakery",
      "Vegetarian"
    ],
    "desc": "Roti sourdough ragi alami buatan sendiri, tumisan jamur portobello & shimeji lokal, krim bawang putih panggang, dan minyak truffle organik.",
    "story": "Ragi sourdough dirawat aktif selama 4 tahun dengan fermentasi lambat 36 jam menghasilkan rongga roti renyah luar biasa dan ramah pencernaan.",
    "image": "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=700&q=80",
    "spec": "360 kkal",
    "origin": "Sourdough 36h Ferment",
    "variantTitle": "Pilihan Tambahan Toping",
    "variants": [
      {
        "label": "Original Truffle Cream",
        "delta": 0
      },
      {
        "label": "Ekstra Keju Emmental",
        "delta": 8000
      },
      {
        "label": "Poached Egg Organik",
        "delta": 6000
      }
    ],
    "stock": 18,
    "isAvailable": true,
    "featured": false,
    "sortOrder": 1
  },
  {
    "id": "prod-03",
    "name": "Bebek Crispy Confit Gianyar",
    "category": "makanan",
    "price": 88000,
    "tags": [
      "Chef Special"
    ],
    "desc": "Bebek lokal Bali dimasak lambat metode confit rempah 8 jam lalu digoreng garing keemasan. Dilengkapi trio sambal matah, mbe, dan embe Bali.",
    "story": "Menggunakan bebek muda dari Gianyar yang direndam dalam rempah base genep lengkap dan lemak bebek murni hingga dagingnya mudah lepas dari tulang.",
    "image": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=700&q=80",
    "spec": "590 kkal",
    "origin": "Gianyar, Bali",
    "variantTitle": "Pilihan Sambal Pendamping",
    "variants": [
      {
        "label": "Trio Sambal Komplit",
        "delta": 0
      },
      {
        "label": "Sambal Matah Sereh Segar",
        "delta": 0
      },
      {
        "label": "Sambal Embe Bawang Crispy",
        "delta": 0
      }
    ],
    "stock": 12,
    "isAvailable": true,
    "featured": false,
    "sortOrder": 2
  },
  {
    "id": "prod-04",
    "name": "Tempeh Avokad Glaze Asam Jawa",
    "category": "makanan",
    "price": 48000,
    "tags": [
      "Plant-Based",
      "Lokal"
    ],
    "desc": "Tempe kedelai lokal non-GMO panggang glasir asam jawa karamel, alpukat mentega segar, rempah biji wijen di atas multigrain toast.",
    "story": "Mengangkat tempe warisan tradisional pengrajin Grobogan, dipadukan karamel asam jawa Purworejo yang gurih, asam, dan legit.",
    "image": "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=700&q=80",
    "spec": "340 kkal",
    "origin": "Kedelai Lokal Grobogan",
    "variantTitle": "Pilihan Roti Dasar",
    "variants": [
      {
        "label": "Multigrain Toast Panggang",
        "delta": 0
      },
      {
        "label": "Gluten-Free Seed Bread",
        "delta": 5000
      },
      {
        "label": "Nasi Merah Organik",
        "delta": 0
      }
    ],
    "stock": 20,
    "isAvailable": true,
    "featured": false,
    "sortOrder": 3
  },
  {
    "id": "prod-05",
    "name": "Uji Matcha Cold Whisk Espresso",
    "category": "minuman",
    "price": 42000,
    "tags": [
      "Favorit",
      "Cold Brew"
    ],
    "desc": "Ceremonial grade Uji Matcha di-whisk segar saat dipesan, dipadukan espresso single-origin Bali Kintamani dan oat milk barista creamy.",
    "story": "Perpaduan harmonis teh hijau Uji Kyoto kelas seremoni dengan aroma citrus segar jeruk kintamani dari kopi pegunungan Bali.",
    "image": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=700&q=80",
    "spec": "140 kkal",
    "origin": "Uji Kyoto x Kintamani Bali",
    "variantTitle": "Pilihan Es & Tingkat Manis",
    "variants": [
      {
        "label": "Normal Ice / Less Sweet 50%",
        "delta": 0
      },
      {
        "label": "Normal Ice / Normal Sugar",
        "delta": 0
      },
      {
        "label": "No Added Sugar (Murni)",
        "delta": 0
      },
      {
        "label": "Hangat / Warm Oat",
        "delta": 0
      }
    ],
    "stock": 40,
    "isAvailable": true,
    "featured": true,
    "sortOrder": 4
  },
  {
    "id": "prod-06",
    "name": "Kopi Kenangan Senja (Butterscotch)",
    "category": "minuman",
    "price": 38000,
    "tags": [
      "Signature Drink"
    ],
    "desc": "Espresso Aceh Gayo washed, saus artisan butterscotch buatan rumah, garam laut Kusamba Bali, dan susu segar steam bertekstur beludru.",
    "story": "Karamel mentega dibuat perlahan dengan gula kelapa organik Kulon Progo dan sejumput kristal garam laut Kusamba yang mengangkat cita rasa manis gurih.",
    "image": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=700&q=80",
    "spec": "190 kkal",
    "origin": "Gayo Arabica x Garam Kusamba",
    "variantTitle": "Suhu & Pilihan Susu",
    "variants": [
      {
        "label": "Dingin (Fresh Milk Standar)",
        "delta": 0
      },
      {
        "label": "Dingin (Oat Milk)",
        "delta": 6000
      },
      {
        "label": "Hangat / Hot Latte",
        "delta": 0
      }
    ],
    "stock": 40,
    "isAvailable": true,
    "featured": false,
    "sortOrder": 5
  },
  {
    "id": "prod-07",
    "name": "Rosella Sparkling Kombucha",
    "category": "minuman",
    "price": 36000,
    "tags": [
      "Organic",
      "Probiotik"
    ],
    "desc": "Fermentasi teh bunga rosella merah liar pegunungan, sereh wangi, madu hutan murni, dan soda alami berkilau menyegarkan.",
    "story": "Difermentasi batch kecil selama 14 hari menghasilkan gelembung mikro alami yang kaya probiotik baik untuk kesehatan pencernaan.",
    "image": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=700&q=80",
    "spec": "65 kkal",
    "origin": "Rosella Lereng Merbabu",
    "variantTitle": "Tingkat Kesegaran Es",
    "variants": [
      {
        "label": "Ice Dingin Segar",
        "delta": 0
      },
      {
        "label": "Chilled Tanpa Es Tambahan",
        "delta": 0
      }
    ],
    "stock": 30,
    "isAvailable": true,
    "featured": false,
    "sortOrder": 6
  },
  {
    "id": "prod-08",
    "name": "Lavender Earl Grey Fog",
    "category": "minuman",
    "price": 39000,
    "tags": [
      "Artisan Tea"
    ],
    "desc": "Seduhan teh hitam bergamot organik, sirup lavender alami, busa susu vanila lembut Madagascar, dan kelopak bunga edible.",
    "story": "Teh bergamot dataran tinggi Malabar dipadukan bunga lavender kering aromaterapi yang menenangkan pikiran di tengah kesibukan.",
    "image": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=700&q=80",
    "spec": "110 kkal",
    "origin": "Perkebunan Malabar Jawa Barat",
    "variantTitle": "Suhu & Penyajian",
    "variants": [
      {
        "label": "Hangat Menenangkan",
        "delta": 0
      },
      {
        "label": "Dingin Berbusa (Iced)",
        "delta": 0
      }
    ],
    "stock": 30,
    "isAvailable": true,
    "featured": false,
    "sortOrder": 7
  },
  {
    "id": "prod-09",
    "name": "Cangkir Stoneware Kasongan (280ml)",
    "category": "barang",
    "price": 125000,
    "tags": [
      "Kriya Lokal",
      "Limited"
    ],
    "desc": "Cangkir keramik tanah liat lokal diputar tangan dan dibakar suhu tinggi 1200°C oleh perajin Kasongan. Tekstur matte alami, tahan panas & microwave.",
    "story": "Setiap cangkir memiliki guratan unik jejak jemari perajin Yogyakarta. Didesain ergonomis pas dalam genggaman untuk momen menyeruput kopi santai.",
    "image": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=700&q=80",
    "spec": "Kapasitas 280ml",
    "origin": "Desa Gerabah Kasongan, DIY",
    "variantTitle": "Pilihan Warna & Finishing",
    "variants": [
      {
        "label": "Terracotta Raw Clay",
        "delta": 0
      },
      {
        "label": "Sandstone Matte Grey",
        "delta": 0
      },
      {
        "label": "Matcha Moss Glaze",
        "delta": 0
      }
    ],
    "stock": 9,
    "isAvailable": true,
    "featured": true,
    "sortOrder": 8
  },
  {
    "id": "prod-10",
    "name": "Biji Kopi Aceh Gayo Anaerobic (250g)",
    "category": "barang",
    "price": 110000,
    "tags": [
      "Specialty Coffee"
    ],
    "desc": "Biji kopi pilihan single-origin Takengon Aceh Gayo, proses fermentasi anaerobik natural. Profil rasa: aprikot, teh hitam, gula aren karamel.",
    "story": "Ditanam pada ketinggian 1.500 mdpl oleh petani koperasi Pantan Musara, disangrai profil medium-light untuk menonjolkan keasaman buah yang jernih.",
    "image": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=700&q=80",
    "spec": "Isi Bersih 250g",
    "origin": "Pantan Musara, Takengon",
    "variantTitle": "Pilihan Bentuk Gilingan",
    "variants": [
      {
        "label": "Biji Utuh (Whole Beans)",
        "delta": 0
      },
      {
        "label": "Giling Kasar (Cold Brew/French Press)",
        "delta": 0
      },
      {
        "label": "Giling Sedang (V60/Aeropress)",
        "delta": 0
      },
      {
        "label": "Giling Halus (Espresso/Mokapot)",
        "delta": 0
      }
    ],
    "stock": 25,
    "isAvailable": true,
    "featured": false,
    "sortOrder": 9
  },
  {
    "id": "prod-11",
    "name": "Bento Cutlery Set Bambu Organik",
    "category": "barang",
    "price": 65000,
    "tags": [
      "Eco-Friendly"
    ],
    "desc": "Set sendok, garpu, pisau mentega, dan sumpit bambu alami halus dilapisi lilin lebah murni, lengkap dengan pouch pembungkus kain linen tenun.",
    "story": "Dibuat dari bambu petung berkelanjutan Jawa Tengah, bebas lapisan kimia beracun, ringan dibawa saat bepergian demi mengurangi sampah plastik sekali pakai.",
    "image": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=700&q=80",
    "spec": "Set 4 Pcs + Pouch",
    "origin": "Pengrajin Bambu Temanggung",
    "variantTitle": "Pilihan Warna Pouch Linen",
    "variants": [
      {
        "label": "Natural Flax Linen",
        "delta": 0
      },
      {
        "label": "Indigo Tenun Biru",
        "delta": 0
      },
      {
        "label": "Olive Green",
        "delta": 0
      }
    ],
    "stock": 16,
    "isAvailable": true,
    "featured": false,
    "sortOrder": 10
  },
  {
    "id": "prod-12",
    "name": "Lilin Kedelai Cendana & Cengkeh (200g)",
    "category": "barang",
    "price": 95000,
    "tags": [
      "Aromaterapi"
    ],
    "desc": "Lilin aromaterapi 100% natural soy wax dalam toples kaca amber, dipadukan minyak atsiri kayu cendana NTT dan sentuhan hangat cengkeh.",
    "story": "Menghadirkan kehangatan malam nusantara dengan sumbu katun bebas timbal, menghasilkan aroma menenangkan yang membantu tidur lelap.",
    "image": "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=700&q=80",
    "spec": "Durasi 45 Jam Bakar",
    "origin": "Kupang x Banyuwangi",
    "variantTitle": "Pilihan Aroma Varian",
    "variants": [
      {
        "label": "Cendana & Cengkeh (Warm Woody)",
        "delta": 0
      },
      {
        "label": "Pandan & Melati (Fresh Floral)",
        "delta": 0
      },
      {
        "label": "Kopi Tubruk & Vanilla (Cozy Sweet)",
        "delta": 0
      }
    ],
    "stock": 14,
    "isAvailable": true,
    "featured": false,
    "sortOrder": 11
  },
  {
    "id": "prod-13",
    "name": "Kemeja Tenun Ikat Flores Kontemporer",
    "category": "fashion",
    "price": 285000,
    "tags": [
      "Karya Artisan",
      "Eco-Fashion"
    ],
    "desc": "Kemeja potongan modern berbahan kain tenun ikat tangan pewarna alam daun tarum dan mengkudu dari perajin perempuan Sikka, Flores.",
    "story": "Ditenun tradisional menggunakan alat tenun bukan mesin (ATBM) selama 21 hari dengan motif geometris penjaga laut yang sarat makna leluhur.",
    "image": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=700&q=80",
    "spec": "Katun Tenun Alami",
    "origin": "Maumere, Sikka, Flores",
    "variantTitle": "Pilihan Ukuran & Pola",
    "variants": [
      {
        "label": "Ukuran M: Dada 104cm",
        "delta": 0
      },
      {
        "label": "Ukuran L: Dada 110cm",
        "delta": 0
      },
      {
        "label": "Ukuran XL: Dada 116cm",
        "delta": 0
      }
    ],
    "stock": 6,
    "isAvailable": true,
    "featured": true,
    "sortOrder": 12
  },
  {
    "id": "prod-14",
    "name": "Dompet Kartu Kulit Nabati Pull-Up",
    "category": "fashion",
    "price": 145000,
    "tags": [
      "Handmade Leather"
    ],
    "desc": "Dompet saku 6 slot kartu dan 1 kompartemen uang kertas, dibuat dari kulit sapi samak nabati tanpa kromium yang menua dengan patina indah.",
    "story": "Dijahit tangan dengan benang lilin poliester tahan putus oleh perajin kulit Manding, Bantul. Semakin sering digunakan, kilau patinanya semakin elegan.",
    "image": "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=700&q=80",
    "spec": "Kulit Sapi Asli 100%",
    "origin": "Sentra Kulit Manding, DIY",
    "variantTitle": "Pilihan Warna Kulit",
    "variants": [
      {
        "label": "Chestnut Tan (Cokelat Hangat)",
        "delta": 0
      },
      {
        "label": "Espresso Dark Brown",
        "delta": 0
      },
      {
        "label": "Olive Green Patina",
        "delta": 0
      }
    ],
    "stock": 11,
    "isAvailable": true,
    "featured": false,
    "sortOrder": 13
  },
  {
    "id": "prod-15",
    "name": "Mechanical Numpad Kayu Jati Solid",
    "category": "gadget",
    "price": 320000,
    "tags": [
      "Tech & Craft",
      "Wireless"
    ],
    "desc": "Numpad mekanikal 18 tombol dengan case kayu jati daur ulang presisi CNC, konektivitas ganda Bluetooth 5.0 dan kabel USB-C berbalut kain.",
    "story": "Menggabungkan kehangatan material kayu jati Jepara dengan switch mekanikal halus berperedam suara silikon untuk kenyamanan mengetik maksimal.",
    "image": "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=700&q=80",
    "spec": "Baterai 1200mAh",
    "origin": "Jepara Wood Tech",
    "variantTitle": "Pilihan Karakter Switch",
    "variants": [
      {
        "label": "Gateron Yellow (Linear Halus & Sunyi)",
        "delta": 0
      },
      {
        "label": "Gateron Brown (Tactile Empuk)",
        "delta": 0
      },
      {
        "label": "Kailh Box White (Clicky Renyah)",
        "delta": 0
      }
    ],
    "stock": 4,
    "isAvailable": true,
    "featured": false,
    "sortOrder": 14
  },
  {
    "id": "prod-16",
    "name": "Desk Mat Kulit Vegan & Felt Wool (80x40cm)",
    "category": "gadget",
    "price": 115000,
    "tags": [
      "Workspace Gear"
    ],
    "desc": "Alas meja kerja dua sisi fleksibel: satu sisi kulit vegan tahan air mudah dibersihkan, sisi lain wol felt alami yang hangat dan lembut untuk mouse optik.",
    "story": "Merapikan ruang kerja dengan sentuhan estetika minimalis, melindungi permukaan meja dari goresan, serta memberikan bantalan tangan saat bekerja lama.",
    "image": "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=700&q=80",
    "spec": "Dimensi 80 x 40 cm",
    "origin": "Studio Kerja Minimalis",
    "variantTitle": "Pilihan Kombinasi Warna",
    "variants": [
      {
        "label": "Forest Green & Warm Grey Felt",
        "delta": 0
      },
      {
        "label": "Tan Mocca & Charcoal Felt",
        "delta": 0
      },
      {
        "label": "Midnight Blue & Ash Felt",
        "delta": 0
      }
    ],
    "stock": 13,
    "isAvailable": true,
    "featured": false,
    "sortOrder": 15
  },
  {
    "id": "prod-17",
    "name": "Kartu Hadiah Digital Atelier (E-Voucher)",
    "category": "digital",
    "price": 100000,
    "tags": [
      "Instant Delivery",
      "Gift Card"
    ],
    "desc": "Voucher belanja digital dengan kode aktivasi instan otomatis setelah scan QRIS. Dapat digunakan untuk belanja makanan, kopi, maupun barang kriya.",
    "story": "Hadiah sempurna tanpa repot untuk kerabat dan rekan kerja. Berlaku selamanya tanpa tanggal kedaluwarsa dan bisa digabung dengan promo lainnya.",
    "image": "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=700&q=80",
    "spec": "Digital Gift Code",
    "origin": "Atelier Digital Registry",
    "variantTitle": "Pilihan Nominal Saldo",
    "variants": [
      {
        "label": "Saldo Rp 100.000",
        "delta": 0
      },
      {
        "label": "Saldo Rp 250.000",
        "delta": 150000
      },
      {
        "label": "Saldo Rp 500.000",
        "delta": 400000
      }
    ],
    "stock": null,
    "isAvailable": true,
    "featured": false,
    "sortOrder": 16
  },
  {
    "id": "prod-18",
    "name": "Tiket Workshop Manual Brew & Cupping",
    "category": "digital",
    "price": 175000,
    "tags": [
      "Interactive Pass",
      "Community"
    ],
    "desc": "Akses eksklusif kelas interaktif 2 jam bersama Q-Grader bersertifikat internasional: belajar kalibrasi grind size, rasio pour over, dan sensori rasa.",
    "story": "Setiap peserta mendapatkan e-sertifikat resmi, lembar panduan cupping digital, serta kupon diskon 20% untuk pembelian biji kopi single origin.",
    "image": "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=700&q=80",
    "spec": "Durasi 120 Menit",
    "origin": "Atelier Coffee Lab",
    "variantTitle": "Pilihan Jadwal Kelas",
    "variants": [
      {
        "label": "Sesi Akhir Pekan (Sabtu 10:00 WIB)",
        "delta": 0
      },
      {
        "label": "Sesi Malam Santai (Jumat 19:30 WIB)",
        "delta": 0
      },
      {
        "label": "Akses Rekaman Video & Modul PDF",
        "delta": 0
      }
    ],
    "stock": 20,
    "isAvailable": true,
    "featured": false,
    "sortOrder": 17
  }
];

export const CATEGORIES = [
  { id: 'makanan', label: 'Makanan' },
  { id: 'minuman', label: 'Minuman' },
  { id: 'barang', label: 'Rumah & kriya' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'gadget', label: 'Gadget' },
  { id: 'digital', label: 'Digital' }
];

export function getCategoryLabel(id) {
  const found = CATEGORIES.find((c) => c.id === id);
  return found ? found.label : 'Lainnya';
}
