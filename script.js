// ScrapeDash — E-Commerce Product Web Scraper
// script.js — All JavaScript Logic

// ===== GLOBAL STATE =====
let scrapedProducts = [];
let scrapeStartTime = 0;
let totalPages = 3;
let currentPage = 0;
let isRunning = false;
let elapsedSeconds = 0;
let timerInterval = null;

// ===== PRODUCT DATA (Book titles + categories) =====
const bookTitles = [
  "A Light in the Attic", "Tipping the Velvet", "Soumission", "Sharp Objects",
  "Sapiens: A Brief History", "The Requiem Red", "The Dirty Little Secrets",
  "The Coming Woman", "The Boys in the Trees", "The Black Maria",
  "Starving Hearts", "Shakespeares Sonnets", "Set Me Free", "Scott Pilgrims",
  "Rip it Up and Start Again", "Our Band Could Be Your Life", "Olio",
  "Mesaerion: The Best Science Fiction", "Libertarianism for Beginners",
  "Its Only the Himalayas", "In Her Wake", "How Music Works", "Foolproof Preserving",
  "Forever Rococo", "Emma", "Eat, Pray, Love", "Deep Blue", "Collections of Poetry",
  "Caught", "Bright Lines", "Birdsong", "A Spy by Nature", "A State of Wonder",
  "1000 Years of Annoying the French", "Pilgrim at Tinker Creek",
  "The Secret Garden", "Pride and Prejudice", "Moby Dick", "The Great Gatsby",
  "To Kill a Mockingbird", "The Catcher in the Rye", "1984", "Brave New World",
  "The Hobbit", "Harry Potter", "The Lord of the Rings", "Dune", "Foundation",
  "Hitchhikers Guide to the Galaxy", "Crime and Punishment", "War and Peace",
  "The Picture of Dorian Gray", "Frankenstein", "Dracula", "The Odyssey",
  "The Iliad", "Don Quixote", "Ulysses", "Middlemarch", "Jane Eyre",
  "Wuthering Heights", "Anna Karenina", "The Brothers Karamazov"
];

const categories = [
  "Fiction", "Mystery", "Science", "History", "Biography",
  "Travel", "Poetry", "Comics", "Romance", "Thriller"
];

function generateProduct(id) {
  const price = (Math.random() * 55 + 5).toFixed(2);
  const rating = Math.ceil(Math.random() * 5);
  const title = bookTitles[id % bookTitles.length];
  const category = categories[Math.floor(Math.random() * categories.length)];
  return { id: id + 1, name: title, price: parseFloat(price), rating, category };
}

// PAGE NAVIGATION
function goTo(page) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });
  const target = document.getElementById('page-' + page);
  if (target) {
    target.style.display = 'flex';
    target.classList.add('active');
  }
  if (page === 'dashboard') updateDashboard();
  if (page === 'export') updateExport();
  updateSidebarCounts();
  window.scrollTo(0, 0);
}

function scrollToTop() { window.scrollTo(0, 0); }

// SCRAPER LOGIC
async function startScraper() {
  const url = document.getElementById('url-input').value.trim();
  const pages = parseInt(document.getElementById('pages-input').value) || 3;
  if (!url) { showNotif('Please enter a website URL to scrape', 'error'); return; }

  try {
    scrapedProducts = [];
    showNotif("Starting real scraper...", "success");

    const response = await fetch("https://your-backend-name.onrender.com/scrape", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: url, pages: pages })
 });

    if (!response.ok) throw new Error(`Network response was not ok (${response.status})`);

    const data = await response.json();

    if (data.status === "success" && Array.isArray(data.products)) {
      scrapedProducts = data.products.map((prod, i) => ({
        id: i + 1,
        name: prod["Product Name"] ?? prod.name ?? "Unknown",
        price: Number(prod["Price (£)"] ?? prod.price ?? 0),
        rating: Number(prod["Rating"] ?? prod.rating ?? 0),
        category: "Books"
      }));

      totalPages = pages;

      showNotif(`✅ Scraped ${data.count || scrapedProducts.length} products successfully`, "success");
      updateDashboard();
      goTo('dashboard');
    } else {
      showNotif("Scraping failed", "error");
    }
  } catch (error) {
    console.error(error);
    showNotif("Backend connection failed", "error");
  }
}

function scrapePage() {
  if (!isRunning) return;
  if (currentPage >= totalPages) { finishScraping(); return; }

  currentPage++;
  const perPage = 20;
  const start = (currentPage - 1) * perPage;
  const pageDelay = 800 + Math.random() * 600;

  addLog('info', `📄 Scraping page ${currentPage}/${totalPages}...`);
  addLog('data', `  GET /catalogue/page-${currentPage}.html`);

  setTimeout(() => {
    if (!isRunning) return;
    addLog('success', `  ✓ HTML downloaded (${(Math.random() * 20 + 15).toFixed(1)}KB)`);
    addLog('data', '  Parsing HTML with BeautifulSoup...');

    let prodAdded = 0;
    const minRating = document.getElementById('filter-toggle').checked ? 3 : 0;

    const addNext = () => {
      if (!isRunning || prodAdded >= perPage) {
        const pct = Math.round((currentPage / totalPages) * 100);
        document.getElementById('progress-fill').style.width = pct + '%';
        document.getElementById('progress-text').textContent = pct + '%';
        document.getElementById('stat-pages').textContent = `${currentPage}/${totalPages}`;
        document.getElementById('sb-pages').textContent = currentPage;
        addLog('success', `  ✓ Page ${currentPage} complete — ${perPage} products extracted`);
        setTimeout(() => scrapePage(), 400);
        return;
      }

      const prod = generateProduct(start + prodAdded);
      if (prod.rating >= minRating) scrapedProducts.push(prod);
      prodAdded++;

      const total = scrapedProducts.length;
      document.getElementById('stat-found').textContent = total;
      document.getElementById('live-found').textContent = total;
      document.getElementById('live-page').textContent = currentPage;

      if (prodAdded % 5 === 0) addLog('data', `  → Extracted: ${prod.name} | £${prod.price} | ${prod.rating}★`);
      updateSidebarCounts();
      setTimeout(addNext, 30);
    };

    addNext();
  }, pageDelay);
}

function finishScraping() {
  isRunning = false;
  clearInterval(timerInterval);

  document.getElementById('run-btn').disabled = false;
  document.getElementById('stop-btn').disabled = true;
  document.getElementById('view-btn').disabled = false;
  document.getElementById('status-label').className = 'badge badge-green';
  document.getElementById('status-label').innerHTML = '✓ Complete';
  document.getElementById('sb-status').textContent = 'Scraping Complete';
  document.getElementById('progress-fill').style.width = '100%';
  document.getElementById('progress-text').textContent = '100%';

  addLog('success', `✅ Scraping complete!`);
  addLog('success', `✓ Total products collected: ${scrapedProducts.length}`);
  addLog('info',    `ℹ Dataset ready for export`);
  addLog('success', '✓ CSV export available');

  showNotif(`✅ Scraped ${scrapedProducts.length} products successfully!`, 'success');
  updateSidebarCounts();
}

function stopScraper() {
  if (!isRunning) return;
  isRunning = false;
  clearInterval(timerInterval);

  addLog('warn', '⚠ Scraping stopped by user');
  document.getElementById('run-btn').disabled = false;
  document.getElementById('stop-btn').disabled = true;
  document.getElementById('status-label').className = 'badge badge-yellow';
  document.getElementById('status-label').innerHTML = '⏸ Stopped';
  document.getElementById('sb-status').textContent = 'Stopped';

  if (scrapedProducts.length > 0) document.getElementById('view-btn').disabled = false;
  showNotif('⏹ Scraping stopped', 'error');
}

// TERMINAL LOG
function addLog(type, msg) {
  const term = document.getElementById('terminal');
  const s = elapsedSeconds;
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  const div = document.createElement('div');
  div.className = 'log-line';
  div.innerHTML = `<span class="log-time">[${mm}:${ss}]</span> <span class="log-${type}">${msg}</span>`;
  term.appendChild(div);
  term.scrollTop = term.scrollHeight;
}
function clearLog() { document.getElementById('terminal').innerHTML = ''; }

// DASHBOARD
function updateDashboard() {
  const products = scrapedProducts;
  const n = products.length;

  document.getElementById('kpi-total').textContent = n;
  document.getElementById('kpi-pages').textContent = `From ${totalPages} pages`;

  if (n === 0) { renderTableRows([]); return; }

  const prices = products.map(p => p.price);
  const avg = prices.reduce((a, b) => a + b, 0) / n;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  document.getElementById('kpi-avg').textContent = '£' + avg.toFixed(2);
  document.getElementById('kpi-range').textContent = `Range: £${min.toFixed(2)} - £${max.toFixed(2)}`;

  const ratings = products.map(p => p.rating);
  const avgRating = ratings.reduce((a, b) => a + b, 0) / n;
  document.getElementById('kpi-rating').textContent = avgRating.toFixed(1);

  const fiveStar = products.filter(p => p.rating === 5).length;
  document.getElementById('kpi-5star').textContent = fiveStar;
  document.getElementById('kpi-5pct').textContent = Math.round(fiveStar / n * 100) + '% of total';

  renderPriceChart(prices);
  renderDonutChart(ratings);
  renderTableRows(products);
}

function renderPriceChart(prices) {
  const ranges = ['£0-15', '£15-25', '£25-35', '£35-45', '£45-55', '£55+'];
  const counts = [0, 0, 0, 0, 0, 0];
  prices.forEach(p => {
    if (p < 15)       counts[0]++;
    else if (p < 25)  counts[1]++;
    else if (p < 35)  counts[2]++;
    else if (p < 45)  counts[3]++;
    else if (p < 55)  counts[4]++;
    else              counts[5]++;
  });

  const maxC = Math.max(...counts);
  const colors = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
  const chart = document.getElementById('price-chart');
  const labels = document.getElementById('chart-labels');
  chart.innerHTML = '';
  labels.innerHTML = '';

  counts.forEach((c, i) => {
    const h = maxC > 0 ? Math.max((c / maxC) * 100, c > 0 ? 8 : 0) : 0;
    const col = document.createElement('div');
    col.className = 'bar-col';
    col.innerHTML = `
      <div style="font-size:10px;color:var(--text3);font-family:'JetBrains Mono',monospace;">${c}</div>
      <div class="bar" style="height:${h}px;background:${colors[i]};opacity:0.85;" title="${ranges[i]}: ${c} products"></div>
    `;
    chart.appendChild(col);

    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:9px;text-align:center;flex:1;color:var(--text3);';
    lbl.textContent = ranges[i];
    labels.appendChild(lbl);
  });
}

function renderDonutChart(ratings) {
  const counts = [0, 0, 0, 0, 0];
  ratings.forEach(r => counts[r - 1]++);
  const total = ratings.length;
  const colors = ['#ef4444', '#f59e0b', '#06b6d4', '#3b82f6', '#10b981'];
  const labels = ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'];
  const r = 45, cx = 60, cy = 60;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  let svgPaths = '';
  counts.forEach((c, i) => {
    const pct = total > 0 ? c / total : 0;
    const dash = pct * circumference;
    const gap = circumference - dash;
    svgPaths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[i]}"
      stroke-width="18" stroke-dasharray="${dash} ${gap}"
      stroke-dashoffset="${-offset}" stroke-linecap="butt"/>`;
    offset += dash;
  });

  const avgRating = total > 0 ? (ratings.reduce((a, b) => a + b, 0) / total).toFixed(1) : '0.0';

  let legendHTML = '';
  counts.forEach((c, i) => {
    const pct = total > 0 ? Math.round(c / total * 100) : 0;
    legendHTML += `<div class="legend-item">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      ${labels[i]}: <b>${c}</b> (${pct}%)
    </div>`;
  });

  document.getElementById('donut-area').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:24px;flex-wrap:wrap;">
      <div class="donut-wrap">
        <svg class="donut-svg" width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="45" fill="none" stroke="var(--bg3)" stroke-width="18"/>
          ${svgPaths}
        </svg>
        <div class="donut-center">
          <div class="donut-val" style="color:var(--yellow)">${avgRating}</div>
          <div class="donut-sub">avg ⭐</div>
        </div>
      </div>
      <div style="text-align:left;">${legendHTML}</div>
    </div>
  `;
}

function renderTableRows(products) {
  const tbody = document.getElementById('product-tbody');
  if (!products || products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:40px;">
      No data yet — run the scraper first 🕷️</td></tr>`;
    document.getElementById('showing-count').textContent = 'Showing 0';
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td class="row-num">${p.id}</td>
      <td style="font-weight:500;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</td>
      <td><span class="price-badge">£${p.price.toFixed(2)}</span></td>
      <td><span class="badge ${p.rating >= 4 ? 'badge-green' : p.rating === 3 ? 'badge-yellow' : 'badge-red'}">
        ${p.rating} Star${p.rating > 1 ? 's' : ''}</span></td>
      <td><span class="stars">${'★'.repeat(p.rating)}${'☆'.repeat(5 - p.rating)}</span></td>
      <td><span class="badge badge-purple" style="font-size:10px;">${p.category}</span></td>
    </tr>
  `).join('');
  document.getElementById('showing-count').textContent = `Showing ${products.length}`;
}

function filterTable() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const minRating = parseInt(document.getElementById('rating-filter').value);
  const sort = document.getElementById('sort-filter').value;

  let filtered = scrapedProducts.filter(p =>
    p.name.toLowerCase().includes(q) && p.rating >= minRating
  );

  if (sort === 'price-asc')    filtered.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc')  filtered.sort((a, b) => b.price - a.price);
  else if (sort === 'rating-desc') filtered.sort((a, b) => b.rating - a.rating);
  else if (sort === 'name-asc')    filtered.sort((a, b) => a.name.localeCompare(b.name));

  renderTableRows(filtered);
}

// EXPORT
function updateExport() {
  const n = scrapedProducts.length;
  const csvSize = n > 0 ? (n * 60 / 1024).toFixed(1) : 0;
  const avgPrice = n > 0 ? (scrapedProducts.reduce((a, b) => a + b.price, 0) / n).toFixed(2) : '0.00';
  const avgRating = n > 0 ? (scrapedProducts.reduce((a, b) => a + b.rating, 0) / n).toFixed(1) : '0.0';

  document.getElementById('exp-records').textContent = n;
  document.getElementById('exp-pages').textContent = totalPages;
  document.getElementById('exp-size').textContent = csvSize + ' KB';
  document.getElementById('exp-time').textContent = elapsedSeconds + 's';
  document.getElementById('preview-count').textContent = n + ' total records';
  document.getElementById('sum-records').textContent = n;
  document.getElementById('sum-pages').textContent = totalPages;
  document.getElementById('sum-avg').textContent = '£' + avgPrice;
  document.getElementById('sum-rating').textContent = avgRating + ' ⭐';

  const preview = scrapedProducts.slice(0, 10);
  const ptbody = document.getElementById('preview-tbody');

  if (preview.length === 0) {
    ptbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:40px;">
      No data yet — run the scraper first 🕷️</td></tr>`;
    return;
  }

  ptbody.innerHTML = preview.map(p => `
    <tr>
      <td class="row-num">${p.id}</td>
      <td style="font-weight:500;">${p.name}</td>
      <td><span class="price-badge">£${p.price.toFixed(2)}</span></td>
      <td>${p.rating}</td>
      <td><span class="stars">${'★'.repeat(p.rating)}${'☆'.repeat(5 - p.rating)}</span></td>
    </tr>
  `).join('') + (n > 10 ? `<tr><td colspan="5" style="text-align:center;color:var(--text3);
    padding:10px;font-style:italic;">... and ${n - 10} more records</td></tr>` : '');
}

function generateCSV() {
  let csv = 'ID,Product Name,Price (GBP),Rating (Stars),Category\n';
  scrapedProducts.forEach(p => {
    const name = p.name.includes(',') ? `"${p.name}"` : p.name;
    csv += `${p.id},${name},${p.price.toFixed(2)},${p.rating},${p.category}\n`;
  });
  return csv;
}

function downloadCSV() {
  if (scrapedProducts.length === 0) { showNotif('⚠️ No data to export. Run the scraper first!', 'error'); return; }
  const blob = new Blob([generateCSV()], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'products.csv'; a.click(); URL.revokeObjectURL(url);
  showNotif('✅ products.csv downloaded successfully!', 'success');
}

function downloadJSON() {
  if (scrapedProducts.length === 0) { showNotif('⚠️ No data to export. Run the scraper first!', 'error'); return; }
  const blob = new Blob([JSON.stringify(scrapedProducts, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'products.json'; a.click(); URL.revokeObjectURL(url);
  showNotif('✅ products.json downloaded!', 'success');
}

function copyCSV() {
  if (scrapedProducts.length === 0) { showNotif('⚠️ No data to copy. Run the scraper first!', 'error'); return; }
  navigator.clipboard.writeText(generateCSV()).then(() => { showNotif('📋 CSV copied to clipboard!', 'success'); });
}

// NOTIFICATIONS
function showNotif(msg, type = 'success') {
  const notif = document.getElementById('notif');
  document.getElementById('notif-icon').textContent = type === 'success' ? '✅' : '⚠️';
  document.getElementById('notif-text').textContent = msg;
  notif.className = 'notif ' + type + ' show';
  setTimeout(() => notif.classList.remove('show'), 3500);
}

// SIDEBAR BADGE COUNTS
function updateSidebarCounts() {
  const n = scrapedProducts.length;
  ['sb-count', 'sb-count2', 'sb-count3'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = n; });
}

// THEME
function applySavedTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') document.body.classList.add('dark-mode');
    else { document.body.classList.remove('dark-mode'); try { localStorage.setItem('theme', 'light'); } catch(e){} }
  } catch (e) { document.body.classList.remove('dark-mode'); }
  updateThemeToggleUI();
}

function toggleTheme() {
  try { const isDark = document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', isDark ? 'dark' : 'light'); updateThemeToggleUI(); } catch (e) {}
}

function updateThemeToggleUI() {
  const isDark = document.body.classList.contains('dark-mode');
  const els = document.querySelectorAll('.theme-toggle');
  els.forEach(btn => { btn.textContent = isDark ? '☀️' : '🌙'; });
}

// SUPPORTED SITES
function toggleSupportedSites() {
  const el = document.getElementById('supported-sites-list');
  const btn = document.getElementById('supported-sites-toggle');
  if (!el || !btn) return;
  if (el.style.display === 'none' || el.style.display === '') { el.style.display = 'block'; btn.textContent = 'Supported Sites ▲'; }
  else { el.style.display = 'none'; btn.textContent = 'Supported Sites ▼'; }
}

function initSupportedSiteCopyButtons() {
  document.querySelectorAll('.copy-link-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = btn.getAttribute('data-url') || btn.dataset.url || '';
      if (!url) return;
      navigator.clipboard.writeText(url).then(() => {
        showNotif('Link copied to clipboard!', 'success');
        const old = btn.innerHTML;
        btn.innerHTML = '✓';
        setTimeout(() => btn.innerHTML = old, 1200);
      }).catch(() => { showNotif('Failed to copy link', 'error'); });
    });
  });
}

// INIT
applySavedTheme();
goTo('landing');
window.addEventListener('DOMContentLoaded', initSupportedSiteCopyButtons);
