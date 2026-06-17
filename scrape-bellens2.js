const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('Attempt 2: ignore-certificate-errors + wait for JS render...');

  const browser = await puppeteer.launch({
    headless: 'new',
    ignoreHTTPSErrors: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--ignore-certificate-errors',
      '--ignore-ssl-errors',
      '--disable-web-security',
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Try the JSON-LD / next.js data approach — AS24 injects __NEXT_DATA__ in the page
  try {
    const url = 'https://www.autoscout24.be/nl/verkopers/vak-garage-autobedrijf-bellens/occasions?atype=C&cid=4798&results=20&page=1';
    console.log('Loading:', url);
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('HTTP status:', resp.status());

    // Wait extra for JS
    await new Promise(r => setTimeout(r, 5000));

    const result = await page.evaluate(() => {
      // Method 1: __NEXT_DATA__
      const nextData = window.__NEXT_DATA__;
      if (nextData) return { method: 'next_data', data: JSON.stringify(nextData).substring(0, 5000) };

      // Method 2: window.__AS24_STATE__ or similar
      const keys = Object.keys(window).filter(k => k.includes('AS24') || k.includes('listings') || k.includes('dealer'));
      if (keys.length) return { method: 'window_keys', data: keys };

      // Method 3: count articles
      const arts = document.querySelectorAll('article');
      return { method: 'fallback', articleCount: arts.length, title: document.title };
    });

    console.log('Page data:', JSON.stringify(result, null, 2).substring(0, 2000));

    if (result.method === 'next_data') {
      // Try to extract cars from Next.js data
      const raw = await page.evaluate(() => JSON.stringify(window.__NEXT_DATA__));
      const parsed = JSON.parse(raw);
      fs.writeFileSync('bellens-nextdata.json', JSON.stringify(parsed, null, 2));
      console.log('Saved __NEXT_DATA__ to bellens-nextdata.json');
    }

  } catch(e) {
    console.log('Error:', e.message);
  }

  // Also try the AS24 internal API endpoints
  console.log('\nTrying AS24 API variations...');
  const apis = [
    'https://www.autoscout24.be/_next/data/build-id/nl/verkopers/vak-garage-autobedrijf-bellens/occasions.json',
    'https://www.autoscout24.be/api/listings?dealerId=4798',
    'https://www.autoscout24.be/nl/verkopers/vak-garage-autobedrijf-bellens/occasions?format=json',
  ];

  for (const api of apis) {
    try {
      const r = await page.goto(api, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const body = await page.content();
      if (body.length > 200 && (body.includes('price') || body.includes('image'))) {
        console.log(`✅ ${api} → ${body.length} bytes`);
        console.log(body.substring(0, 500));
      } else {
        console.log(`❌ ${api} → ${body.length} bytes (no car data)`);
      }
    } catch(e) {
      console.log(`❌ ${api} → ${e.message.substring(0, 60)}`);
    }
  }

  await browser.close();
})();
