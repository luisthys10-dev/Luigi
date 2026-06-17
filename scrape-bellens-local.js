/**
 * scrape-bellens-local.js
 * ─────────────────────────────────────────────────────────────────────────
 * Run this script op je EIGEN COMPUTER (niet op een server).
 * AutoScout24 is alleen bereikbaar vanuit een echte browser/computer.
 *
 * INSTALLATIE (eenmalig):
 *   npm install puppeteer
 *
 * UITVOERING:
 *   node scrape-bellens-local.js
 *
 * OUTPUT:
 *   → bellens-cars.json        (alle auto-data als JSON)
 *   → bellens-cars.js          (voor automatisch laden in de website)
 *   → bellens-website.html     (automatisch geüpdated met echte data)
 * ─────────────────────────────────────────────────────────────────────────
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const DEALER_URL = 'https://www.autoscout24.be/nl/verkopers/vak-garage-autobedrijf-bellens/occasions';
const DEALER_ID  = '4798';
const MAX_PAGES  = 4;
const HTML_FILE  = path.join(__dirname, 'bellens-website.html');

// ── CATEGORIE-DETECTIE ──────────────────────────────────────────────────
function detectCats(title, fuel) {
  const t = (title + ' ' + fuel).toLowerCase();
  const cats = [];
  if (t.includes('elektrisch') || t.includes('electric') || t.includes('hybride') || t.includes('hybrid')) cats.push('elektrisch');
  if (t.includes('q2') || t.includes('q3') || t.includes('q4') || t.includes('q5') || t.includes('q7') || t.includes('q8') ||
      t.includes('x1') || t.includes('x2') || t.includes('x3') || t.includes('x4') || t.includes('x5') || t.includes('x6') || t.includes('x7') ||
      t.includes('suv') || t.includes('crossover') || t.includes('touareg') || t.includes('tiguan') || t.includes('tucson') ||
      t.includes('range rover') || t.includes('velar') || t.includes('discovery') ||
      t.includes('kamiq') || t.includes('kodiaq') || t.includes('karoq') ||
      t.includes('mokka') || t.includes('kuga') || t.includes('ecosport')) cats.push('suv');
  if (t.includes('cabrio') || t.includes('roadster') || t.includes('cooper works') || t.includes('abarth') ||
      t.includes('sport') || t.includes('gti') || t.includes('gts') || t.includes('m sport') ||
      t.includes('z3') || t.includes('z4') || t.includes('tt') || t.includes('r8')) cats.push('sport');
  return cats;
}

function parsePrice(str) {
  if (!str) return 0;
  return parseInt(str.replace(/[^0-9]/g, '')) || 0;
}

function parseKm(str) {
  if (!str) return 0;
  return parseInt(str.replace(/[^0-9]/g, '')) || 0;
}

// ── MAIN ────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n🚗 Autobedrijf Bellens — AutoScout24 Scraper');
  console.log('═'.repeat(50));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'nl-BE,nl;q=0.9,en;q=0.8' });
  await page.setViewport({ width: 1440, height: 900 });

  const allCars = [];

  for (let p = 1; p <= MAX_PAGES; p++) {
    const url = `${DEALER_URL}?atype=C&cid=${DEALER_ID}&sort=standard&results=20&page=${p}`;
    console.log(`\n📄 Pagina ${p}/4: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });
      // Extra wachttijd voor lazy loading
      await new Promise(r => setTimeout(r, 3000));

      // Scroll pagina om lazy-loaded images te triggeren
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
        return new Promise(r => setTimeout(r, 1000));
      });
      await new Promise(r => setTimeout(r, 1500));

      const pageTitle = await page.title();
      console.log(`   Titel: ${pageTitle}`);

      const cars = await page.evaluate(() => {
        const results = [];

        // Probeer meerdere selectors — AS24 wijzigt zijn klassen regelmatig
        const articleSelectors = [
          'article[data-testid="regular-listing-item"]',
          'article[data-testid="listing-item"]',
          'article[data-item-name="regular-listing-item"]',
          '.ListItem_wrapper__',
          'article.cldt-summary-full-item',
          'article',
        ];

        let articles = [];
        for (const sel of articleSelectors) {
          articles = Array.from(document.querySelectorAll(sel));
          if (articles.length > 2) break;
        }

        // Als geen articles gevonden: probeer __NEXT_DATA__
        if (articles.length === 0 && window.__NEXT_DATA__) {
          try {
            const props = window.__NEXT_DATA__.props;
            const listings = props?.pageProps?.listings?.data?.listings || [];
            listings.forEach(l => {
              const img = l.images?.[0]?.url || '';
              results.push({
                title:   `${l.vehicle?.make} ${l.vehicle?.model}`,
                merk:    l.vehicle?.make || '',
                model:   l.vehicle?.model || '',
                jaar:    l.vehicle?.firstRegistrationYear || 0,
                km:      l.mileage?.value || 0,
                prijs:   l.prices?.public?.priceRaw || 0,
                brandstof: l.vehicle?.fuel || '',
                pk:      l.vehicle?.power || 0,
                foto:    img ? img.replace(/\/\d+x\d+\.(webp|jpg)/g, '/800x600.webp') : '',
                url:     `https://www.autoscout24.be/nl/auto/${l.vehicle?.makeSlug}/${l.vehicle?.modelSlug}/${l.id}`,
                source:  'next_data',
              });
            });
            return results;
          } catch (e) {}
        }

        articles.forEach(article => {
          // ── FOTO ──
          let foto = '';
          const imgEl = article.querySelector('img');
          if (imgEl) {
            foto = imgEl.src || imgEl.dataset?.src || imgEl.dataset?.lazySrc || '';
            // Upgrade naar hogere resolutie
            if (foto && !foto.startsWith('data:')) {
              foto = foto
                .replace(/\/\d+x\d+\.(webp|jpg)/gi, '/800x600.webp')
                .replace(/w=\d+/g, 'w=800')
                .replace(/h=\d+/g, 'h=600');
            } else {
              foto = '';
            }
            // Probeer srcset voor betere kwaliteit
            const srcset = imgEl.srcset || imgEl.dataset?.srcset || '';
            if (srcset) {
              const parts = srcset.split(',').map(s => s.trim()).filter(Boolean);
              const last = parts[parts.length - 1];
              if (last) {
                const srcUrl = last.split(' ')[0];
                if (srcUrl && !srcUrl.startsWith('data:')) {
                  foto = srcUrl.replace(/\/\d+x\d+\.(webp|jpg)/gi, '/800x600.webp');
                }
              }
            }
          }

          // ── LISTING URL ──
          const linkEl = article.querySelector('a[href*="/nl/auto/"]') || article.querySelector('a[href]');
          let href = linkEl?.getAttribute('href') || '';
          const listingUrl = href.startsWith('http') ? href : 'https://www.autoscout24.be' + href;

          // ── TITEL ──
          const titleEl = article.querySelector('h2') || article.querySelector('h3');
          const title = titleEl?.innerText?.trim() || '';

          // ── PRIJS ──
          let prijs = '';
          const priceSelectors = ['[data-testid="price-label"]','[data-testid="price"]','[class*="Price"]','[class*="price"]','.cldt-price'];
          for (const sel of priceSelectors) {
            const el = article.querySelector(sel);
            if (el?.innerText?.trim()) { prijs = el.innerText.trim(); break; }
          }

          // ── DETAILS (km, jaar, brandstof) ──
          const details = {};
          article.querySelectorAll('[data-testid]').forEach(el => {
            const key = el.dataset.testid || '';
            const val = el.innerText?.trim() || '';
            if (val) details[key] = val;
          });

          // Fallback: zoek km/jaar tekst
          const allText = article.innerText || '';
          const kmMatch = allText.match(/(\d[\d\.]+)\s*km/i);
          const yearMatch = allText.match(/\b(19|20)\d{2}\b/);

          if (title || foto) {
            results.push({
              title,
              prijs,
              foto,
              url: listingUrl,
              km:   kmMatch ? kmMatch[1].replace(/\./g, '') : '',
              jaar: yearMatch ? yearMatch[0] : '',
              details: JSON.stringify(details),
              source: 'article',
            });
          }
        });

        return results;
      });

      allCars.push(...cars);
      console.log(`   ✅ ${cars.length} auto's gevonden`);
      cars.slice(0, 3).forEach((c, i) => {
        console.log(`      ${i+1}. ${c.title} | ${c.prijs} | foto: ${c.foto ? '✅' : '❌'}`);
      });

    } catch (err) {
      console.error(`   ❌ Fout op pagina ${p}: ${err.message}`);
    }

    // Korte pauze tussen pagina's
    if (p < MAX_PAGES) await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();

  if (allCars.length === 0) {
    console.log('\n⚠️  Geen auto\'s gevonden. Mogelijke oorzaken:');
    console.log('   - AutoScout24 heeft zijn HTML-structuur gewijzigd');
    console.log('   - Controleer of de dealerpagina bereikbaar is in je browser');
    console.log('   - Probeer later opnieuw');
    process.exit(1);
  }

  // ── VERWERK DATA ─────────────────────────────────────────────────────
  const processedCars = allCars.map((c, i) => {
    const parts = (c.title || '').split(' ');
    const merk  = parts[0] || '';
    const model = parts.slice(1).join(' ') || '';
    const prijs = typeof c.prijs === 'number' ? c.prijs : parsePrice(c.prijs);
    const km    = typeof c.km === 'number' ? c.km : parseKm(String(c.km));
    const jaar  = typeof c.jaar === 'number' ? c.jaar : parseInt(String(c.jaar)) || 0;
    const cats  = detectCats(c.title, c.brandstof || '');
    if (prijs < 15000 && prijs > 0 && !cats.includes('goedkoop')) cats.push('goedkoop');

    return {
      id:       i + 1,
      merk:     merk,
      model:    model,
      jaar:     jaar,
      km:       km,
      prijs:    prijs,
      brandstof: c.brandstof || '',
      pk:       c.pk || 0,
      cats:     cats,
      foto:     c.foto || '',
      url:      c.url || 'https://www.autoscout24.be/nl/verkopers/vak-garage-autobedrijf-bellens/occasions',
    };
  });

  // ── SLA OP ALS JSON ──────────────────────────────────────────────────
  fs.writeFileSync('bellens-cars.json', JSON.stringify(processedCars, null, 2));
  console.log(`\n✅ ${processedCars.length} auto's opgeslagen → bellens-cars.json`);

  // ── GENEREER bellens-cars.js (laadbaar als <script> tag) ──────────────
  const jsContent = `/* Gegenereerd door scrape-bellens-local.js op ${new Date().toLocaleDateString('nl-BE')} */
window.BELLENS_SCRAPED_CARS = ${JSON.stringify(processedCars, null, 2)};
`;
  fs.writeFileSync('bellens-cars.js', jsContent);
  console.log('✅ bellens-cars.js aangemaakt (wordt automatisch geladen door de website)');

  // ── FOTO RAPPORT ─────────────────────────────────────────────────────
  console.log('\n📸 Foto overzicht:');
  const withFoto    = processedCars.filter(c => c.foto).length;
  const withoutFoto = processedCars.length - withFoto;
  console.log(`   ${withFoto} met foto | ${withoutFoto} zonder foto`);
  processedCars.forEach((c, i) => {
    const icon = c.foto ? '✅' : '❌';
    const fotoPart = c.foto ? c.foto.substring(0, 60) + '...' : 'geen foto';
    console.log(`   ${i+1}. ${icon} ${c.merk} ${c.model} (${c.jaar}) | ${fotoPart}`);
  });

  // ── UPDATE bellens-website.html ALS AANWEZIG ──────────────────────────
  if (fs.existsSync(HTML_FILE)) {
    let html = fs.readFileSync(HTML_FILE, 'utf8');

    // Voeg bellens-cars.js script tag toe als die er nog niet in zit
    if (!html.includes('bellens-cars.js')) {
      html = html.replace(
        '</head>',
        '<script src="bellens-cars.js" onerror="console.log(\'bellens-cars.js not found, using fallback\')"></script>\n</head>'
      );
      // Voeg JS logic toe om BELLENS_SCRAPED_CARS te gebruiken als die beschikbaar is
      html = html.replace(
        'window.addEventListener(\'DOMContentLoaded\', loadCars);',
        `window.addEventListener('DOMContentLoaded', () => {
  if (window.BELLENS_SCRAPED_CARS && window.BELLENS_SCRAPED_CARS.length > 0) {
    console.log('Using scraped data:', window.BELLENS_SCRAPED_CARS.length, 'cars');
    renderCars(window.BELLENS_SCRAPED_CARS);
  } else {
    loadCars();
  }
});`
      );
      fs.writeFileSync(HTML_FILE, html, 'utf8');
      console.log('\n✅ bellens-website.html automatisch geüpdated!');
    } else {
      console.log('\nℹ️  bellens-website.html is al geconfigureerd voor bellens-cars.js');
    }
  }

  console.log('\n🎉 KLAAR! Volgende stap:');
  console.log('   1. Zorg dat bellens-cars.js en bellens-website.html in dezelfde map staan');
  console.log('   2. Open bellens-website.html in je browser');
  console.log('   3. De website laadt automatisch alle echte auto\'s met foto\'s\n');
})();
