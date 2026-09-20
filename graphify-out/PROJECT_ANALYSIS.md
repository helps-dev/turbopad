# Analisis TurboPad

Tanggal: 20 September 2026. Cakupan: folder lokal Turbopad, pembacaan seluruh kode UI, graphify, pemeriksaan sintaks JavaScript, dan uji browser terbatas. Tidak ada perubahan pada kode aplikasi atau deployment.

## Kesimpulan

TurboPad adalah prototipe frontend interaktif untuk discovery market meme dan konsep RWA. Fondasi presentasi sudah tersedia, tetapi sistem belum merupakan launchpad operasional. README secara eksplisit menyatakan wallet, kontrak blockchain, data pasar langsung, bonding curve, dan backend RWA belum terhubung. Tidak ada backend, smart contract, package manifest, test suite, atau pipeline CI dalam folder yang ditinjau. Kesimpulan ini tidak mencakup repositori atau layanan lain di luar folder tersebut.

## Struktur

| Berkas | Tanggung jawab |
| --- | --- |
| Web/dist/index.html | Shell halaman, navigasi, banner, market spotlight, tabel, dialog |
| Web/dist/app.js | Delapan market demo, state view/filter/watchlist, render kartu, dialog, simulasi |
| Web/dist/terminal.js | Tabel market, list/cards, grafik spotlight dan pilihan periode |
| Web/dist/motion.js | Animasi kemunculan dan efek pointer dengan reduced-motion |
| Web/dist/launch-motion.js | Carousel featured market dan canvas animasi |
| Web/dist/style.css | Layout responsif dan beberapa lapisan override tema |
| Web/.openai/hosting.json | Konfigurasi hosting statis untuk dist; bukan bukti deployment aktif |
| asset/ | Dua aset branding PNG; tidak dirujuk oleh halaman saat ini |

Alur render: state global dan array markets → render kartu → MutationObserver → tabel membaca data-detail dari kartu tersembunyi → tabel dibuat ulang. Carousel juga memakai markets dan chart global dari app.js. Urutan pemuatan skrip merupakan bagian dari kontrak aplikasi yang belum dinyatakan sebagai module imports.

## Kekuatan

- UI mencakup pencarian, filter sumber/kategori, radar, watchlist, daftar/kartu, detail market, voting demo, dan simulasi pendapatan kreator.
- Penandaan demo konsisten dan penjelasan RWA dibedakan dari momentum meme.
- Tidak membutuhkan framework atau dependency frontend eksternal untuk dijalankan.
- Ada native dialog, label aksesibilitas, aria-pressed, pengelolaan inert pada slide tersembunyi, dan reduced-motion.
- Animasi banner berhenti ketika dokumen tersembunyi, banner di luar viewport, pointer berada di banner, atau fokus berada di dalamnya.

## Temuan prioritas

### 1. Logo home tidak melakukan navigasi aplikasi — terkonfirmasi di browser

Lokasi: Web/dist/index.html:3 dan Web/dist/app.js:19.
Logo memakai href="#", sedangkan handler navigasi hanya memproses button dengan data-view. Langkah reproduksi: buka Creator Studio lalu klik logo. URL mendapat # tetapi view tetap Creator Studio. Hubungkan logo ke state/router Explore dan pertahankan semantik link.

### 2. Hero Explore berubah setelah navigasi — terkonfirmasi di browser

Lokasi: Web/dist/index.html:4 dan Web/dist/app.js:14.
Saat awal, judul memakai baris terpisah dan em: “Your next move. Starts here.” Setelah pindah ke Creator Studio lalu Explore, setView menulis textContent “Find your next move.” sehingga struktur em/br dan copy awal hilang. Gunakan satu sumber template/copy untuk tampilan awal dan navigasi.

### 3. Tabel tergantung DOM kartu tersembunyi — temuan arsitektur

Lokasi: Web/dist/terminal.js:18 dan Web/dist/terminal.js:31.
Setiap filter merender kartu lalu observer membangun tabel dari tombol data-detail di kartu, termasuk ketika kartu tidak terlihat. Ini menggandakan pekerjaan render dan membuat perubahan markup kartu dapat merusak tabel. Bentuk fungsi selector market bersama dan render langsung ke layout aktif. Belum dilakukan benchmark kinerja; ini risiko pertumbuhan, bukan klaim bottleneck terukur pada delapan market.

### 4. State hanya di memori dan tidak mempunyai URL view

Lokasi: Web/dist/app.js:10 dan Web/dist/app.js:14.
Watchlist memakai Set tanpa persistensi. Refresh mengembalikan state awal. UI menyebut “this session’s watchlist”, jadi ini batas desain saat ini, bukan kegagalan terhadap janji persistensi. Untuk produk, gunakan ID token stabil, persistensi, serta navigasi yang mendukung reload/back/deep link.

### 5. CSS bertumpuk dan warna grafik tidak sepenuhnya mengikuti tema

Lokasi: Web/dist/style.css:1, :51, :97, :104; Web/dist/app.js:11; Web/dist/terminal.js:30.
Terdapat beberapa definisi :root serta override tema. Grafik JS menggunakan warna literal hijau; aturan .table-spark svg polyline memberi seluruh garis tabel warna emas, termasuk market negatif. Perubahan harga tetap ditulis sebagai angka negatif, tetapi kode warna arah grafik hilang. Konsolidasikan design tokens dan gunakan token warna semantik naik/turun.

### 6. Rendering data eksternal perlu batas keamanan yang jelas

Lokasi: Web/dist/app.js:12 dan :16; Web/dist/terminal.js:26.
Nama/simbol/data market diinterpolasi melalui innerHTML. Data sekarang merupakan konstanta lokal, sehingga audit ini tidak mengklaim eksploitasi dari input yang ada. Sebelum memasukkan data API/metadata token, gunakan textContent atau mekanisme escaping yang sesuai konteks, validasi URL/warna, serta skema data.

## Validasi

- node --check lulus untuk app.js, terminal.js, motion.js, launch-motion.js.
- Halaman lokal berhasil dimuat dengan delapan market.
- Creator Studio menampilkan simulasi $500 untuk volume default $100000.
- Logo home dan perubahan hero direproduksi sebagaimana dijelaskan di atas.
- Pencarian GLITCH menghasilkan satu baris Glitch Goblin.
- Screenshot desktop menunjukkan tampilan tabel, radar, dan navigasi; tabel membutuhkan scroll horizontal pada viewport pengujian.
- Belum dilakukan uji seluruh interaksi, viewport mobile, audit aksesibilitas penuh, profiling kinerja, atau pengujian integrasi blockchain/backend.

## Urutan pengembangan yang disarankan

1. Rapikan navigasi home/hero, state bersama, renderer tabel/kartu, dan token CSS.
2. Tentukan kontrak data market: ID stabil, angka numerik, sumber, timestamp, status verifikasi, loading/error/empty states.
3. Tambahkan satu integrasi data read-only dan persistensi watchlist; validasi sebelum memperluas fitur.
4. Jika sasaran berikutnya launchpad operasional, implementasikan flow wallet/testnet, kontrak, simulasi transaksi, penanganan kegagalan, dan verifikasi terpisah. RWA membutuhkan model issuer/collateral/redemption yang nyata; kartu konsep saja belum cukup.
5. Tambahkan pengujian alur penting, konfigurasi build yang reproducible, version control, dan CI sesuai ruang lingkup implementasi.

## Peta graphify

47 node, 50 edge, 9 komunitas. Pemeriksaan graph tidak menemukan dangling endpoint, missing endpoint, self-loop, atau edge collapse. Graph AST belum memodelkan seluruh hubungan state global dan observer DOM; temuan kode langsung melengkapi graph. Statistik token ekstraksi agen tidak tersedia. Lihat graph.html dan GRAPH_REPORT.md pada folder ini.
