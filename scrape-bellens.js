const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('Starting Puppeteer scraper for Autobedrijf Bellens...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'nl-BE,nl;q=0.9' });

  const allCars = [];
  const totalPages = 4;

  for (let p = 1; p <= totalPages; p++) {
    const url = `https://www.autoscout24.be/nl/verkopers/vak-garage-autobedrijf-bellens/occasions?atype=C&cid=4798&sort=standard&results=20&page=${p}`;
    console.log(`\nFetching page ${p}: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
      await new Promise(r => setTimeout(r, 3000));

      // Dump page title and a snippet to see what we got
      const title = await page.title();
      console.log(`  Page title: ${title}`);

      const cars = await page.evaluate(() => {
        const results = [];

        // Try multiple selectors for AS24 listings
        const selectors = [
          'article[data-testid="regular-listing-item"]',
          'article[data-testid="listing-item"]',
          'article.ListItem_wrapper__',
          'article',
          '[data-item-name="listing-item"]',
        ];

        let articles = [];
        for (const sel of selectors) {
          articles = Array.from(document.querySelectorAll(sel));
          if (articles.length > 0) {
            console.log('Found with selector:', sel, articles.length);
            break;
          }
        }

        articles.forEach(article => {
          // Foto — try multiple img selectors
          let foto = '';
          const imgSelectors = [
            'img[src*="prod.pictures.autoscout24.net"]',
            'img[src*="autoscout24"]',
            'img[data-src*="autoscout24"]',
            'img[srcset*="autoscout24"]',
            'picture img',
            'img'
          ];
          for (const sel of imgSelectors) {
            const img = article.querySelector(sel);
            if (img) {
              const src = img.src || img.dataset.src || '';
              if (src && !src.includes('data:')) {
                foto = src.replace(/\/\d+x\d+\.(webp|jpg)/g, '/800x600.webp');
                break;
              }
            }
          }

          // Link
          const link = article.querySelector('a[href]');
          const href = link ? link.getAttribute('href') : '';
          const listingUrl = href.startsWith('http') ? href : 'https://www.autoscout24.be' + href;

          // Title / name
          const titleEl = article.querySelector('h2') || article.querySelector('h3') || article.querySelector('[class*="title"]');
          const title = titleEl ? titleEl.innerText.trim() : '';

          // Price
          const priceSelectors = ['[data-testid="price"]','[data-testid="price-label"]','.price','[class*="Price"]','[class*="price"]'];
          let prijs = '';
          for (const sel of priceSelectors) {
            const el = article.querySelector(sel);
            if (el) { prijs = el.innerText.trim(); break; }
          }

          // Specs (km, year, fuel)
          const specs = [];
          const specSelectors = ['[data-testid*="spec"]','[data-testid*="mileage"]','[data-testid*="registration"]','[data-testid*="fuel"]','[class*="spec"]','[class*="attribute"]'];
          specSelectors.forEach(sel => {
            article.querySelectorAll(sel).forEach(el => {
              const t = el.innerText.trim();
              if (t && !specs.includes(t)) specs.push(t);
            });
          });

          if (title || foto) {
            results.push({ title, prijs, foto, url: listingUrl, specs: specs.join(' | ') });
          }
        });

        return results;
      });

      allCars.push(...cars);
      console.log(`  Found ${cars.length} cars on page ${p}`);
      if (cars.length > 0) {
        console.log(`  First: ${cars[0].title} | foto: ${cars[0].foto ? '✅' : '❌'}`);
      }
    } catch (err) {
      console.error(`  Error on page ${p}: ${err.message}`);
    }
  }

  await browser.close();

  if (allCars.length > 0) {
    fs.writeFileSync('bellens-cars.json', JSON.stringify(allCars, null, 2));
    console.log(`\n✅ Done! ${allCars.length} cars saved to bellens-cars.json`);
    allCars.forEach((c, i) => {
      console.log(`  ${i+1}. ${c.title || '(no title)'} → ${c.foto ? '✅ foto' : '❌ no foto'} | ${c.prijs || 'no price'}`);
    });
  } else {
    console.log('\n⚠️  No cars found via Puppeteer — will try API fallback');
    fs.writeFileSync('bellens-cars.json', JSON.stringify([], null, 2));
  }
})();
