// Đồng bộ Google Sheet -> data.js cho trang Tủ đồ Tulip.
// Chạy tự động bằng GitHub Actions mỗi 3 giờ (xem .github/workflows/sync-sheet.yml),
// hoặc chạy tay:  node sync.mjs
//
// Việc script làm:
// 1) Đọc danh sách tab (tên + gid) từ trang htmlview của Google Sheet — tab mới thêm
//    vào sheet tự được nhận, không cần sửa code.
// 2) Tải từng tab về dạng CSV rồi nhận diện cột theo tên tiêu đề (Brand/Sản phẩm,
//    Link, Phong cách, Phân loại, Ghi chú/Lý do, Phân khúc giá) — bất kể thứ tự cột.
// 3) Ghi tất cả vào data.js (bản dữ liệu sẵn trong trang, dùng khi không tải được sheet).

import fs from 'node:fs/promises';

const SHEET_ID = '1W41kcOQO3v_1oZIZ_pe3urvyKqJb5Vx2sQNUh2jxGP4';
const BASE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_cb=' + Date.now(), { headers: { 'User-Agent': UA } }).catch(() => null);
    if (res?.ok) return await res.text();
    if (i < tries - 1) await sleep(4000 * (i + 1));
  }
  throw new Error('Không tải được ' + url.split('?')[0]);
}

// Danh sách tab: trang htmlview chứa JS dạng items.push({name: "...", ..., gid: "..."})
async function listTabs() {
  const html = await fetchText(`${BASE}/htmlview`);
  const tabs = [];
  const re = /items\.push\(\{name:\s*"((?:[^"\\]|\\.)*)"[^}]*?gid:\s*"(\d+)"/g;
  let m;
  while ((m = re.exec(html))) tabs.push({ name: JSON.parse('"' + m[1] + '"'), gid: m[2] });
  if (!tabs.length) throw new Error('Không đọc được danh sách tab từ htmlview');
  return tabs;
}

// ============ Các hàm parse (giống hệt bản trong index.html) ============

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const fold = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().trim();
const cleanCell = (v) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

// Nhóm danh mục cố định theo tên tab; tab "Tổng hợp" để danh mục theo cột Phân loại.
// Tab lạ sau này (vd "Đồ ăn") lấy chính tên tab làm danh mục -> nút lọc tự xuất hiện.
function tabCat(name) {
  const n = fold(name);
  if (n.includes('tong hop')) return null;
  if (n.includes('my pham')) return 'Mỹ phẩm';
  if (n.includes('phu kien')) return 'Phụ kiện';
  if (n.includes('qua tang') || n.includes('qua ny')) return 'Quà tặng';
  return name.trim();
}

// Tìm cột theo tên tiêu đề (so cả có dấu lẫn không dấu), trả về -1 nếu không có.
function colBy(header, needles) {
  const h = header.map(fold);
  for (const n of needles) {
    const i = h.findIndex((x) => x === n);
    if (i !== -1) return i;
  }
  for (const n of needles) {
    const i = h.findIndex((x) => x.includes(n));
    if (i !== -1) return i;
  }
  return -1;
}

function parseTab(rows, tab) {
  if (!rows.length) return [];
  const H = rows[0];
  const iLink = colBy(H, ['link']);
  if (iLink === -1) return []; // tab không có cột link -> bỏ qua
  const iBrand = colBy(H, ['san pham nhac', 'ten san pham', 'san pham', 'brand', 'ten']);
  const iStyle = colBy(H, ['phong cach']);
  const iCat = colBy(H, ['phan loai']);
  const iNote = colBy(H, ['ghi chu', 'ly do']);
  const iPrice = colBy(H, ['phan khuc gia', 'gia']);
  const fixedCat = tabCat(tab.name);
  const out = [];
  for (const r of rows.slice(1)) {
    const link = cleanCell(r[iLink] || '');
    if (!/^https?:\/\//i.test(link)) continue;
    const rowCat = iCat !== -1 ? cleanCell(r[iCat] || '') : '';
    // Ưu tiên cột Phong cách; tab có danh mục cố định (Mỹ phẩm...) thì dùng giá trị
    // cột Phân loại làm tag (vd "Son", "Kem nền"); còn lại thì lấy tên tab.
    const style = (iStyle !== -1 ? cleanCell(r[iStyle] || '')
      : fixedCat && iCat !== -1 ? rowCat : '') || tab.name;
    out.push({
      tab: tab.name,
      style,
      brand: (iBrand !== -1 ? cleanCell(r[iBrand] || '') : '') || 'Shop',
      cat: fixedCat || rowCat || 'Đồ nữ',
      note: iNote !== -1 ? cleanCell(r[iNote] || '') : '',
      price: iPrice !== -1 ? cleanCell(r[iPrice] || '') : '',
      link,
    });
  }
  return out;
}

// ============ Đồng bộ ============

async function main() {
  const tabs = await listTabs();
  console.log('Các tab tìm thấy: ' + tabs.map((t) => `${t.name} (gid ${t.gid})`).join(', '));

  const shops = [];
  const seen = new Set();
  let failed = [];
  for (const t of tabs) {
    const csv = await fetchText(`${BASE}/gviz/tq?tqx=out:csv&gid=${t.gid}`).catch((e) => {
      failed.push(t.name);
      console.warn('Lỗi tab ' + t.name + ': ' + e.message);
      return null;
    });
    if (csv == null) continue;
    if (/setResponse\(/.test(csv.slice(0, 200))) {
      failed.push(t.name);
      console.warn('Tab ' + t.name + ' trả về lỗi gviz, bỏ qua.');
      continue;
    }
    for (const s of parseTab(parseCSV(csv), t)) {
      if (seen.has(s.link)) continue;
      seen.add(s.link);
      shops.push(s);
    }
    await sleep(1500); // nghỉ giữa các tab để Google không chặn
  }
  if (failed.length) throw new Error('Tab lỗi, giữ nguyên data.js cũ: ' + failed.join(', '));

  const payload = {
    sheetId: SHEET_ID,
    tabs: tabs.map((t) => ({ name: t.name, gid: t.gid })),
    shops,
  };

  // Chỉ ghi khi nội dung (tab + shop) khác bản hiện có — tránh commit rác mỗi lần chạy.
  try {
    const prev = await fs.readFile('data.js', 'utf8');
    const old = JSON.parse(prev.slice(prev.indexOf('{'), prev.lastIndexOf('}') + 1));
    if (JSON.stringify({ tabs: old.tabs, shops: old.shops }) === JSON.stringify({ tabs: payload.tabs, shops: payload.shops })) {
      console.log('Sheet chưa có gì mới (tab + dữ liệu giống hệt), giữ nguyên data.js.');
      return;
    }
  } catch { /* chưa có data.js -> ghi mới */ }

  const out = { updated: new Date().toISOString(), ...payload };
  const js = '// TỰ SINH BỞI sync.mjs — ĐỪNG SỬA TAY.\n// Nguồn: Google Sheet, các tab: "' + tabs.map((t) => t.name).join('", "') + '"\n'
    + 'window.TULIP_DATA = ' + JSON.stringify(out, null, 2) + ';\n';
  await fs.writeFile('data.js', js, 'utf8');
  console.log(`Đồng bộ xong: ${shops.length} link từ ${tabs.length} tab -> data.js.`);
}

main().catch((e) => { console.error(e.stack || e); process.exit(1); });
