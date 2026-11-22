/* Buku Panduan: cara bermain, asal bahan, resep, goa, laut, online. */
import { ITEMS, CRAFT } from './items.js';
import { BUILD } from './pieces.js';
import { ico, costIcons, hydrate } from './icons.js';

const $ = (id) => document.getElementById(id);

/* asal tiap bahan: [item, cara mendapatkan] */
const SOURCES = [
  ['kayu', 'Tebang pohon: dekati pohon, TAHAN tombol Serang. Kapak membuatnya jauh lebih cepat.'],
  ['batu', 'Pukul batu abu-abu besar yang tersebar di tanah (tahan tombol Serang). Di dalam goa juga banyak.'],
  ['serat', 'Dari menebang pohon (sering muncul) dan memukul semak buah. Tebang beberapa pohon sampai cukup.'],
  ['tali', 'DIBUAT, bukan dicari: Tas > tab Bahan > Tali (butuh 3 Serat).'],
  ['papan', 'DIBUAT: Tas > tab Bahan > Papan x2 (butuh 3 Kayu).'],
  ['tanah', 'Pegang Sekop, arahkan ke tanah (bukan air), tahan tombol Serang untuk menggali.'],
  ['cacing', 'Kadang keluar saat menggali tanah dengan Sekop. Dipakai sebagai umpan Pancing.'],
  ['buah', 'Pukul semak buah (semak hijau dengan bulatan ungu). Bisa dimakan untuk menambah lapar.'],
  ['daging', 'Berburu kelinci, rusa, atau serigala. Lebih mudah dengan Tombak/Pedang.'],
  ['ikan', 'Pegang Pancing, lempar ke laut yang dalam, tunggu sampai ikan menggigit lalu tekan Serang.'],
  ['bijih', 'Hanya di DALAM GOA: bijih berwarna oranye. Butuh Beliung untuk memecahkannya.'],
  ['batubara', 'Hanya di DALAM GOA: bijih hitam. Butuh Beliung. Dipakai untuk melebur dan membuat Lampu.'],
  ['besi', 'DIBUAT di Tungku: berdiri dekat Tungku, tekan tombol Lebur (bijih + batu bara).'],
  ['obor', 'DIBUAT: Tas > tab Cahaya > Obor (1 Kayu + 1 Serat). Wajib dibawa ke dalam goa.'],
];

const TABS = {
  Mulai() {
    return `
<h4>Tujuan</h4>
<p>Bertahan hidup di pulau: kumpulkan bahan, bangun rumah, masak, tambang di goa, lalu berlayar. Ikuti <b>Misi</b> di kiri atas layar, urut dari 1 sampai 17.</p>
<h4>Tombol di layar</h4>
<div class="gRow">${ico('fist')}<div><b>Serang / Ambil</b>TAHAN dekat pohon, batu, hewan, atau bijih untuk memukul. Saat mode bangun, tombol ini jadi pemasang bangunan.</div></div>
<div class="gRow">${ico('jump')}<div><b>Lompat</b>Melompati rintangan dan memanjat tangga.</div></div>
<div class="gRow">${ico('crouch')}<div><b>Jongkok</b>Berjongkok / merunduk.</div></div>
<div class="gRow">${ico('hammer')}<div><b>Bangun</b>Buka/tutup mode membangun. Pilih bagian di bar bawah, lalu tekan tombol aksi untuk memasang.</div></div>
<div class="gRow">${ico('meat')}<div><b>Makan</b>Memakai makanan di tas untuk mengisi bar lapar.</div></div>
<div class="gRow">${ico('bag')}<div><b>Tas</b>Lihat isi tas dan <b>buat barang (crafting)</b>. Semua alat dibuat di sini.</div></div>
<div class="gRow">${ico('heart')}<div><b>Bar status</b>Nyawa (merah), lapar (oranye), haus (biru). Kalau lapar/haus habis, nyawa berkurang.</div></div>
<div class="gTip">Tombol tambahan (Masak, Tidur, Buka pintu, Minum, Kemudi, dll.) muncul otomatis di dekat benda yang bisa dipakai.</div>`;
  },

  Bahan() {
    return '<h4>Bahan didapat dari mana?</h4><p>Semua bahan ada sumbernya. Ini daftar lengkapnya:</p>' +
      SOURCES.map(([k, t]) => `<div class="gRow">${ico(k)}<div><b>${ITEMS[k]}</b>${t}</div></div>`).join('') +
      `<div class="gTip"><b>Soal Tali:</b> tidak ada Tali yang bisa ditemukan di tanah. Tebang pohon sampai punya 3 Serat, buka Tas, tab <b>Bahan</b>, tekan <b>Buat</b> pada Tali. Beliung butuh 1 Tali.</div>`;
  },

  Resep() {
    const cats = [...new Set(CRAFT.map((r) => r.cat))];
    let h = '<h4>Resep di Tas</h4><p>Buka Tas, pilih tab, tekan Buat. Alat yang sudah dibuat muncul di hotbar bawah layar: ketuk untuk memegangnya.</p>';
    for (const c of cats) {
      h += `<h4>${c}</h4>`;
      for (const r of CRAFT.filter((x) => x.cat === c)) {
        const icon = r.cart ? 'gerobak' : r.tool ? r.id : Object.keys(r.give)[0];
        h += `<div class="gRow">${ico(icon)}<div><b>${r.n}</b>${costIcons(r.cost)}</div></div>`;
      }
    }
    return h;
  },

  Bangun() {
    let h = '<h4>Membangun</h4><ol><li>Tekan tombol <b>Bangun</b> (ikon palu).</li><li>Geser bar bawah untuk memilih bagian.</li><li>Arahkan ke tempat yang diinginkan; bayangan hijau berarti bisa dipasang.</li><li>Tekan tombol aksi untuk memasang. Tombol putar untuk memutar arah.</li><li>Pilih <b>Bongkar</b> lalu tekan aksi pada bangunan untuk membongkarnya (bahan kembali separuh).</li></ol>';
    h += '<h4>Daftar bangunan</h4>';
    for (const k of Object.keys(BUILD)) {
      if (k === 'bongkar') continue;
      h += `<div class="gRow">${ico('b_' + k)}<div><b>${BUILD[k].n}</b>${costIcons(BUILD[k].cost)}</div></div>`;
    }
    h += '<div class="gTip">Rumah sederhana: pasang Lantai, 4 Dinding di tepinya, Pintu, lalu Atap. Taruh Kasur di dalam supaya bisa tidur. Api Unggun/Kompor untuk memasak.</div>';
    return h;
  },

  Goa() {
    return `
<h4>Cara menemukan Goa</h4>
<ul>
<li>Lihat <b>panah kuning</b> di bawah kotak misi (kiri atas). Panah itu selalu menunjuk ke goa terdekat dan menampilkan jarak (meter). Berjalanlah ke arah panah.</li>
<li>Goa ada di <b>lereng gunung/bukit</b>. Pintunya berupa lengkung batu gelap dengan bingkai kayu.</li>
<li>Ada beberapa goa tersebar di seluruh pulau, jadi selalu ada yang lumayan dekat.</li>
<li>Berjalan masuk ke lengkung pintu goa, layar akan memudar lalu kamu berada di dalam tambang.</li>
</ul>
<h4>Di dalam goa</h4>
<ol>
<li>Siapkan <b>Obor</b> (Tas > Cahaya) dan pegang di hotbar, karena sangat gelap.</li>
<li>Pegang <b>Beliung</b> (Tas > Alat; butuh Tali). Tanpa Beliung, bijih tidak bisa dipecah.</li>
<li>Tahan tombol Serang pada bijih oranye (Bijih Besi) dan hitam (Batu Bara).</li>
<li>Untuk keluar, jalan ke pintu terang di ujung tambang.</li>
</ol>
<h4>Mengolah bijih jadi besi</h4>
<ol>
<li>Gali Tanah dengan Sekop (3 Tanah) dan kumpulkan 8 Batu.</li>
<li>Bangun <b>Tungku</b> (menu Bangun).</li>
<li>Berdiri dekat Tungku, tekan tombol <b>Lebur</b> (tombolnya selalu muncul di dekat Tungku). Bijih Besi (oranye, dari goa) + Batu Bara atau 2 Kayu menjadi Besi. Tanpa bijih, tombol berubah jadi <b>Masak</b> untuk daging/ikan mentah.</li>
</ol>
<div class="gTip">Besi dipakai untuk Panci, Kapak Besi, Beliung Besi, Pedang Besi, Lampu, Kompor, Mesin dan Setir kapal.</div>`;
  },

  Laut() {
    return `
<h4>Memancing</h4>
<ol><li>Buat <b>Pancing</b> (2 Kayu + 3 Tali).</li><li>Pegang di hotbar, arahkan ke laut yang dalam, tekan Serang untuk melempar.</li><li>Saat ikan menggigit, tekan Serang lagi. Pakai Cacing sebagai umpan agar lebih cepat.</li><li>Masak ikan di api supaya jadi Ikan Bakar.</li></ol>
<h4>Minum</h4>
<p>Buat <b>Ember</b>, arahkan ke air lalu tekan Serang untuk mengisi. Tombol <b>Minum</b> muncul di dekat air.</p>
<h4>Membuat kapal</h4>
<ol>
<li>Bangun <b>Dermaga</b> dari pantai ke arah laut (butuh Papan dan Tali).</li>
<li>Pasang <b>Lantai</b> di atas air untuk menyusun lambung kapal.</li>
<li>Pasang <b>Mesin Kapal</b> dan <b>Setir Kapal</b> di atas lantai kapal.</li>
<li>Dekati Setir, tekan tombol <b>Kemudi</b>, lalu gerakkan joystick untuk berlayar.</li>
</ol>`;
  },

  Online() {
    return `
<h4>Dunia sendiri</h4>
<p>Di menu utama, tekan <b>Buat Dunia</b>, beri nama lalu <b>Play</b>. Dunia tersimpan otomatis di HP-mu. Semua dunia ada di daftar Dunia Saya.</p>
<h4>Mengajak teman</h4>
<ul>
<li>Selama kotak <b>Izinkan pemain lain masuk</b> dicentang, duniamu muncul di <b>Room Global</b> (menu Online). Teman tinggal mengetuknya.</li>
<li>Pemain yang masuk membawa tas kosong dan ikut membangun di duniamu.</li>
<li>Kalau kamu keluar dari dunia, pemain lain ikut keluar.</li>
</ul>
<h4>Room biasa</h4>
<p>Menu Online > Buat Room (bisa pakai kata sandi) lalu tekan GAS setelah semua siap. Atau masuk Open World yang selalu terbuka.</p>
<h4>Mic dan chat</h4>
<p>Saat online ada tombol Chat dan Mic di kanan atas.</p>
<div class="gTip">Online butuh internet. Kalau temanmu memakai hotspot dari HP yang punya kuota, itu sudah cukup: semua yang tersambung ke hotspot itu bisa masuk Room Global.</div>`;
  },
};

let cur = 'Mulai';

function render() {
  const names = Object.keys(TABS);
  const tabs = $('guideTabs');
  tabs.innerHTML = '';
  for (const n of names) {
    const b = document.createElement('button');
    b.className = 'tabBtn' + (n === cur ? ' on' : '');
    b.textContent = n;
    b.onclick = () => { cur = n; render(); };
    tabs.appendChild(b);
  }
  const body = $('guideBody');
  body.innerHTML = TABS[cur]();
  body.scrollTop = 0;
}

export function openGuide(tab) {
  if (tab && TABS[tab]) cur = tab;
  render();
  $('mGuide').classList.add('show');
}

export function initGuide() {
  hydrate($('mGuide'));
  $('guideClose').onclick = () => $('mGuide').classList.remove('show');
}
