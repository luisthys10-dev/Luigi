'use strict';

/* ══════════════════════════════════════════════
   DE BAREEL — script.js
   ══════════════════════════════════════════════ */

// ── 1. LOADING SCREEN ──
const loadingScreen = document.getElementById('loading-screen');
if (loadingScreen) {
  if (!sessionStorage.getItem('visited')) {
    sessionStorage.setItem('visited', '1');
    setTimeout(() => loadingScreen.classList.add('loaded'), 800);
  } else {
    loadingScreen.classList.add('loaded');
  }
}

// ── 2. NAV SCROLL ──
const header = document.querySelector('.site-header');
const SCROLL_THRESHOLD = 80;

window.addEventListener('scroll', () => {
  if (header) {
    header.classList.toggle('scrolled', window.scrollY > SCROLL_THRESHOLD);
  }
  updateActiveNav();
}, { passive: true });

// ── 3. ACTIVE NAV ──
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.navbar-links a');

function updateActiveNav() {
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 130) {
      current = sec.id;
    }
  });
  navLinks.forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + current);
  });
}

// Initial call
updateActiveNav();

// ── 4. MOBILE MENU ──
const toggle = document.querySelector('.navbar-toggle');
const mobileMenu = document.querySelector('.mobile-menu');
const mobileClose = document.querySelector('.mobile-menu-close');

if (toggle && mobileMenu) {
  toggle.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    mobileMenu.setAttribute('aria-hidden', String(!isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  if (mobileClose) {
    mobileClose.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      mobileMenu.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    });
  }

  mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      mobileMenu.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    });
  });
}

// ── 5. SCROLL ANIMATIONS (IntersectionObserver) ──
const animObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const parent = entry.target.parentElement;
      const siblings = parent ? parent.querySelectorAll('[data-animate]') : [];
      let delay = 0;
      siblings.forEach((el, idx) => {
        if (el === entry.target) delay = idx * 80;
      });
      setTimeout(() => {
        entry.target.classList.add('animated');
      }, delay);
      animObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('[data-animate]').forEach(el => animObserver.observe(el));

// ── 6. COUNTER ANIMATION ──
function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

function animateCounter(el) {
  const target = parseFloat(el.dataset.target);
  const isDecimal = el.dataset.decimal === 'true';
  const duration = 1800;
  const start = performance.now();

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutQuart(progress);
    const value = target * eased;
    el.textContent = isDecimal ? value.toFixed(1) : Math.floor(value);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = isDecimal ? target.toFixed(1) : target;
    }
  }

  requestAnimationFrame(step);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.counter').forEach(el => counterObserver.observe(el));

// ── 7. MENU CARD TOGGLE ──
document.querySelectorAll('.card-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const card = btn.closest('.menu-card');
    const items = card ? card.querySelector('.card-items') : null;
    if (!items) return;

    const isOpen = card.classList.toggle('open');
    items.style.maxHeight = isOpen ? items.scrollHeight + 'px' : '0';
    btn.textContent = isOpen ? 'Verberg aanbod ↑' : 'Bekijk aanbod ↓';
    btn.setAttribute('aria-expanded', String(isOpen));
    items.setAttribute('aria-hidden', String(!isOpen));
  });
});

// ── 8. OPENING HOURS LIVE STATUS ──
function updateOpeningHours() {
  const now = new Date();
  const day = now.getDay();       // 0=Sun, 1=Mon ... 6=Sat
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeVal = hour * 60 + minute;

  // data-day: 0=Mon(JS 1), 1=Tue(JS 2), 2=Wed(JS 3), 3=Thu(JS 4), 4=Fri(JS 5), 5=Sat(JS 6), 6=Sun(JS 0)
  let isOpen = false;

  const rows = document.querySelectorAll('.hours-table tr[data-day]');
  rows.forEach(row => {
    const rowDay = parseInt(row.dataset.day, 10);
    // Convert data-day → JS weekday
    const jsDay = rowDay === 6 ? 0 : rowDay + 1;

    if (jsDay === day) {
      row.classList.add('today');
      // Mon–Fri (data-day 0–4): 07:00 (420) – 17:00 (1020)
      if (rowDay <= 4) {
        if (timeVal >= 420 && timeVal < 1020) {
          isOpen = true;
          row.classList.add('is-open');
        } else {
          row.classList.add('is-closed');
        }
      } else {
        // Sat/Sun always closed in regular hours
        row.classList.add('is-closed');
      }
    }
  });

  const statusEl = document.querySelector('.live-status');
  if (statusEl) {
    if (isOpen) {
      statusEl.innerHTML =
        '<span class="status-dot open"></span>' +
        '<strong style="color:var(--color-open)">Nu open</strong>' +
        '<span style="color:var(--color-muted);font-size:0.85rem"> — sluit om 17:00</span>';
    } else {
      statusEl.innerHTML =
        '<span class="status-dot closed"></span>' +
        '<strong style="color:var(--color-closed)">Gesloten</strong>';
    }
  }
}

updateOpeningHours();

// ── 9. RESERVATION FORM ──
const form = document.getElementById('reservation-form');
const formSuccess = document.querySelector('.form-success');

if (form) {
  // Set min date to tomorrow
  const dateInput = form.querySelector('input[type="date"]');
  if (dateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.min = tomorrow.toISOString().split('T')[0];
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Basic validation
    const naam = form.querySelector('[name="naam"]');
    const telefoon = form.querySelector('[name="telefoon"]');
    const personen = form.querySelector('[name="personen"]');
    const datum = form.querySelector('[name="datum"]');

    if (!naam.value.trim() || !telefoon.value.trim() || !personen.value || !datum.value) {
      // Shake required fields that are empty
      [naam, telefoon, personen, datum].forEach(field => {
        if (!field.value.trim()) {
          field.style.borderColor = 'var(--color-closed)';
          field.addEventListener('input', () => {
            field.style.borderColor = '';
          }, { once: true });
        }
      });
      return;
    }

    // Animate form out
    form.style.transition = 'opacity 0.4s ease';
    form.style.opacity = '0';

    setTimeout(() => {
      form.style.display = 'none';
      if (formSuccess) {
        formSuccess.style.display = 'flex';
        // Animate checkmark
        const checkPath = formSuccess.querySelector('.checkmark-path');
        if (checkPath) {
          // Force a reflow before adding class
          void checkPath.getBoundingClientRect();
          checkPath.classList.add('checkmark-animated');
        }
      }
    }, 400);
  });
}

// ── 10. CHATBOT ──
const chatToggle   = document.getElementById('chat-toggle');
const chatWindow   = document.getElementById('chat-window');
const chatClose    = document.getElementById('chat-close');
const chatMessages = document.getElementById('chat-messages');
const chatInput    = document.getElementById('chat-input');
const chatSend     = document.getElementById('chat-send');
const quickReplies = document.getElementById('quick-replies');
const notifDot     = document.querySelector('.notification-dot');

let chatOpen    = false;
let welcomeSent = false;

// Map display labels → intent keys (used internally for routing)
const QUICK_BUTTON_MAP = {
  'Openingstijden':   'openingstijden',
  'Ons aanbod':       'aanbod',
  'Broodjes':         'broodjes',
  'Koffie':           'koffie',
  'Gebak':            'gebak',
  'Ontbijtbuffet':    'ontbijtbuffet',
  'Ontbijtmanden':    'ontbijtmand',
  'Terras':           'terras',
  'Reserveren':       'reserveren',
  'Adres & Route':    'adres',
  'Adres':            'adres',
  'Contact':          'contact',
};

function getAntwoord(input) {
  const s = input.toLowerCase();
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  if (/open|sluit|uur|tijd|wanneer|gesloten|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|weekend|vakantie/.test(s)) {
    return {
      antwoord: "<strong>Onze openingstijden:</strong><br><br>Maandag t/m Vrijdag: <strong>07:00 – 17:00</strong><br>Zaterdag & Zondag: <strong>Gesloten</strong><br><br>Elke 2de & 4de zaterdag zijn we open voor het <strong>ontbijtbuffet</strong>!<br><br><em>Zomer (april–oktober): keuken sluit om 16u.</em>",
      knoppen: ['Ons aanbod', 'Ontbijtbuffet', 'Adres']
    };
  }

  if (/adres|waar|route|locatie|parkeer|fiets|trein|station|bouwel|grobbendonk|maps|hoe kom/.test(s)) {
    return {
      antwoord: "<strong>Je vindt ons hier:</strong><br><br>Herenthoutsesteenweg 4<br>2288 Bouwel (Grobbendonk)<br><br><a href='https://maps.google.com/?q=Herenthoutsesteenweg+4,+2288+Grobbendonk' target='_blank'>Open in Google Maps →</a><br><br>Op slechts <strong>114 meter van Station Bouwel</strong> — perfect bereikbaar met trein of fiets!",
      knoppen: ['Openingstijden', 'Contact']
    };
  }

  if (/aanbod|menu|wat|eten|drinken|assortiment|product|kaart|hebben|krijgen/.test(s) && !/broodje|sandwich|koffie|espresso/.test(s)) {
    return {
      antwoord: "<strong>Ons aanbod bij De Bareel:</strong><br><br>🥪 Verse belegde broodjes<br>☕ Koffie & warme dranken<br>🥤 Koude dranken & milkshakes<br>🍰 Gebak van de week<br>🍳 Ontbijtbuffet (2de & 4de za)<br>🧺 Ontbijtmanden<br><br>Elke dag vers, elke dag met liefde!",
      knoppen: ['Broodjes', 'Koffie', 'Ontbijtbuffet', 'Ontbijtmanden', 'Gebak']
    };
  }

  if (/broodje|sandwich|beleg|hesp|kaas|ei|gezond|warm|croque|tosti|lunch|groep/.test(s)) {
    return {
      antwoord: "<strong>Onze verse broodjes:</strong><br><br>Ons paradepaardje! Dagelijks vers belegd:<br>• Klassiek: hesp, kaas, ei, smos<br>• Gezond: met verse groenten<br>• Luxe: zalm, carpaccio, ...<br>• Warm: croque, tosti, ...<br>• Dagverse salade<br><br>Groepsbestellingen? Bel ons op <a href='tel:014517757'>014 51 77 57</a>!",
      knoppen: ['Koffie', 'Ontbijtbuffet', 'Reserveren']
    };
  }

  if (/koffie|espresso|cappuccino|latte|thee|chocolade|milkshake|ijs|fris|sap/.test(s)) {
    return {
      antwoord: "<strong>Dranken bij De Bareel:</strong><br><br><strong>Warm:</strong><br>Espresso · Cappuccino · Latte macchiato · Americano · Thee · Warme chocolademelk<br><br><strong>Koud:</strong><br>Vers fruitsap · Frisdranken · Milkshakes · IJskoffie · Water (plat & bruis)<br><br>Alles bereid met zorg!",
      knoppen: ['Broodjes', 'Gebak', 'Openingstijden']
    };
  }

  if (/gebak|taart|koek|zoet|cake|dessert|week/.test(s)) {
    return {
      antwoord: "<strong>Gebak van de week:</strong><br><br>Elke week een andere verwennerij — huisgemaakt of zorgvuldig geselecteerd. Vraag ernaar bij je bezoek!<br><br>Perfect bij een koffie of cappuccino.",
      knoppen: ['Koffie', 'Ons aanbod', 'Openingstijden']
    };
  }

  if (/ontbijtbuffet|buffet|brunch/.test(s) || (/2de|4de|vierde|tweede/.test(s) && /zaterdag|ontbijt/.test(s))) {
    return {
      antwoord: "<strong>Ontbijtbuffet bij De Bareel:</strong><br><br>Elke <strong>2de en 4de zaterdag</strong> van de maand organiseren we een uitgebreid ontbijtbuffet!<br><br>Ideaal voor het hele gezin of een gezellig moment met vrienden. Reservatie is <strong>sterk aanbevolen</strong>.<br><br>Reserveer via <a href='tel:014517757'>014 51 77 57</a> of via ons <a href='#reserveren'>online formulier</a>.",
      knoppen: ['Reserveren', 'Openingstijden', 'Ontbijtmanden']
    };
  }

  if (/ontbijtmand|mand|cadeau|thuis|bezorg|gift|pakket|verras/.test(s)) {
    return {
      antwoord: "<strong>Ontbijtmanden van De Bareel:</strong><br><br>Het perfecte cadeau of een verrassingsontbijt!<br><br>Ideaal voor verjaardagen, moederdag, babyborrels en meer.<br><br>Bestel minstens <strong>1 dag op voorhand</strong>. Plaatsen zijn beperkt!<br><br>Bel <a href='tel:014517757'>014 51 77 57</a> of mail <a href='mailto:info@debareel.be'>info@debareel.be</a>",
      knoppen: ['Ontbijtbuffet', 'Reserveren', 'Contact']
    };
  }

  if (/terras|buiten|tuin|zon|zitten|zomer|achter|gezellig/.test(s)) {
    return {
      antwoord: "<strong>Ons terras:</strong><br><br>Achter onze zaak schuilt een heerlijk terras — omringd door groen, perfect voor een rustige koffie of een uitgebreide lunch in de zon.<br><br><em>'Pleasant terrace at the back — a hidden gem!'</em> — Klantreview",
      knoppen: ['Reserveren', 'Openingstijden', 'Ons aanbod']
    };
  }

  if (/reserv|boek|tafel|plek|afspraak|vergader|feest/.test(s)) {
    return {
      antwoord: "<strong>Reserveren bij De Bareel:</strong><br><br>Je kunt op 3 manieren reserveren:<br><br>1. Via ons <a href='#reserveren'>online formulier</a><br>2. Telefonisch: <a href='tel:014517757'>014 51 77 57</a><br>3. Per e-mail: <a href='mailto:info@debareel.be'>info@debareel.be</a><br><br>Voor het ontbijtbuffet en groepen: reserveer zeker op voorhand!",
      knoppen: ['Ontbijtbuffet', 'Openingstijden', 'Contact']
    };
  }

  if (/contact|bel|telefoon|gsm|mail|email|nummer|bereik|facebook|instagram|sociaal/.test(s)) {
    return {
      antwoord: "<strong>Contactgegevens De Bareel:</strong><br><br>Telefoon: <a href='tel:014517757'>014 51 77 57</a><br>GSM: <a href='tel:0476469108'>0476 46 91 08</a><br>E-mail: <a href='mailto:info@debareel.be'>info@debareel.be</a><br><br><a href='https://www.facebook.com/people/De-Bareel/100084503757029' target='_blank'>Facebook</a> · <a href='https://www.instagram.com/debareelbouwel' target='_blank'>Instagram</a>",
      knoppen: ['Openingstijden', 'Adres']
    };
  }

  if (/fiets|fietsen|stop|route|tocht|wielren|mountainbike/.test(s)) {
    return {
      antwoord: "<strong>De Bareel — Perfecte fietsstop!</strong><br><br>Op slechts 114m van Station Bouwel en makkelijk bereikbaar via diverse fietsroutes.<br><br>Ideaal voor een tussenstop: een vers broodje, een koffie en weer op weg!<br><br><em>'Great breakfast. Good stop with the bike.'</em> — Klantreview",
      knoppen: ['Ons aanbod', 'Adres', 'Openingstijden']
    };
  }

  if (/allergi|gluten|lactose|vegetar|vegan|dieet|intolerant/.test(s)) {
    return {
      antwoord: "Heb je <strong>allergieën of dieetwensen</strong>?<br>Laat het ons zeker weten — we doen ons best om voor iedereen iets lekkers te voorzien!<br><br>Bel ons op <a href='tel:014517757'>014 51 77 57</a> of vermeld het bij je reservatie.",
      knoppen: ['Reserveren', 'Ons aanbod', 'Contact']
    };
  }

  if (/prijs|kost|euro|hoeveel|duur|goedkoop|budget|tarief/.test(s)) {
    return {
      antwoord: "Voor prijzen kun je ons best even bellen of langskomen — zo helpen we je persoonlijk!<br><br>Telefoon: <a href='tel:014517757'>014 51 77 57</a><br><br>Wij staan voor <strong>eerlijke prijzen</strong> en dagverse kwaliteit.",
      knoppen: ['Ons aanbod', 'Openingstijden', 'Contact']
    };
  }

  if (/groep|evenement|vergader|feest|bedrijf|catering|event|groot/.test(s)) {
    return {
      antwoord: "<strong>Groepen & events bij De Bareel:</strong><br><br>We ontvangen graag grotere groepen! Of het nu gaat om een vergadering, teamlunch of familiegebeuren — we stellen graag een aanbod op maat samen.<br><br>Neem contact op:<br>Telefoon: <a href='tel:014517757'>014 51 77 57</a><br>E-mail: <a href='mailto:info@debareel.be'>info@debareel.be</a>",
      knoppen: ['Reserveren', 'Ons aanbod']
    };
  }

  if (/kenneth|eigenaar|zaakvoerder|wie|baas|team|personeel|chef/.test(s)) {
    return {
      antwoord: "<strong>Kenneth Laureys — Uw gastheer:</strong><br><br>Kenneth en zijn team staan elke dag voor je klaar met een glimlach en een vers broodje. De Bareel is al meer dan 20 jaar een vertrouwd adres in Bouwel — een echte buurtontmoetingsplek waar iedereen welkom is.",
      knoppen: ['Ons aanbod', 'Openingstijden']
    };
  }

  if (/dank|bedankt|merci|super|top|geweldig|perfect|fijn|ok|goed/.test(s)) {
    return {
      antwoord: rand([
        "Graag gedaan! Tot gauw bij De Bareel in Bouwel! ☕",
        "Met plezier! Kenneth en team verwelkomen je graag!",
        "Altijd! Als je nog vragen hebt, ik ben er voor je!"
      ]),
      knoppen: ['Openingstijden', 'Ons aanbod']
    };
  }

  if (/lekker|heerlijk|zalig|top zaak|beste|aanrader|fan/.test(s)) {
    return {
      antwoord: "Dankjewel! Dat doet ons enorm deugd! We doen elke dag ons best — geweldig om te horen dat je dat merkt. Tot gauw!",
      knoppen: ['Openingstijden', 'Ons aanbod']
    };
  }

  if (/hallo|hoi|goedemorgen|goedemiddag|goedenavond|hey|hi\b|dag\b|goeie/.test(s)) {
    return {
      antwoord: rand([
        "Hallo! Welkom bij De Bareel! Hoe kan ik je helpen? 😊",
        "Goeiedag! Fijn dat je er bent! Waarmee kan ik je vandaag helpen?",
        "Hoi! Stel gerust je vraag — ik help je graag!"
      ]),
      knoppen: ['Openingstijden', 'Ons aanbod', 'Reserveren', 'Ontbijtbuffet', 'Adres & Route']
    };
  }

  // Fallback
  return {
    antwoord: rand([
      "Hmm, daar weet ik het antwoord niet meteen op. Contacteer ons gerust:<br>Telefoon: <a href='tel:014517757'>014 51 77 57</a><br>E-mail: <a href='mailto:info@debareel.be'>info@debareel.be</a>",
      "Goede vraag! Bel Kenneth of het team even, zij helpen je zeker verder!<br><a href='tel:014517757'>014 51 77 57</a>"
    ]),
    knoppen: ['Contact', 'Openingstijden', 'Adres', 'Ons aanbod']
  };
}

function addMessage(text, type) {
  if (!chatMessages) return null;
  const msg = document.createElement('div');
  msg.className = `chat-msg ${type}`;
  msg.innerHTML = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return msg;
}

function showTyping() {
  if (!chatMessages) return null;
  const div = document.createElement('div');
  div.className = 'chat-msg bot typing-indicator';
  div.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function setQuickReplies(buttons) {
  if (!quickReplies) return;
  quickReplies.innerHTML = '';
  if (!buttons || !buttons.length) return;
  buttons.forEach(label => {
    const btn = document.createElement('button');
    btn.className = 'quick-btn';
    btn.textContent = label;
    btn.setAttribute('type', 'button');
    btn.addEventListener('click', () => {
      const intent = QUICK_BUTTON_MAP[label] || label;
      handleUserMessage(label, intent);
    });
    quickReplies.appendChild(btn);
  });
}

function handleUserMessage(displayText, intentText) {
  if (!chatInput) return;
  chatInput.value = '';
  const resolvedText = intentText || displayText;
  addMessage(displayText, 'user');
  const typing = showTyping();
  const delay = 600 + Math.random() * 500;
  setTimeout(() => {
    if (typing) typing.remove();
    const { antwoord, knoppen } = getAntwoord(resolvedText);
    addMessage(antwoord, 'bot');
    setQuickReplies(knoppen || []);
  }, delay);
}

if (chatToggle) {
  chatToggle.addEventListener('click', () => {
    chatOpen = !chatOpen;

    if (chatOpen) {
      chatWindow.style.display = 'flex';
      chatWindow.classList.add('open');
      if (notifDot) notifDot.style.display = 'none';

      if (!welcomeSent) {
        welcomeSent = true;
        setTimeout(() => {
          addMessage(
            "Hallo! 👋 Welkom bij <strong>De Bareel</strong> in Bouwel!<br>Ik help je graag met vragen over ons aanbod, openingstijden, het ontbijtbuffet of reservaties.<br><br>Wat kan ik voor je doen?",
            'bot'
          );
          setQuickReplies(['Openingstijden', 'Ons aanbod', 'Ontbijtbuffet', 'Ontbijtmanden', 'Reserveren', 'Adres & Route', 'Contact']);
        }, 400);
      }

      setTimeout(() => {
        if (chatInput) chatInput.focus();
      }, 350);

    } else {
      chatWindow.style.display = 'none';
      chatWindow.classList.remove('open');
    }
  });
}

if (chatClose) {
  chatClose.addEventListener('click', () => {
    chatOpen = false;
    if (chatWindow) {
      chatWindow.style.display = 'none';
      chatWindow.classList.remove('open');
    }
  });
}

if (chatSend) {
  chatSend.addEventListener('click', () => {
    const val = chatInput ? chatInput.value.trim() : '';
    if (val) handleUserMessage(val);
  });
}

if (chatInput) {
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = chatInput.value.trim();
      if (val) handleUserMessage(val);
    }
  });
}

// ── 11. SMOOTH SCROLL FOR ANCHOR LINKS ──
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const href = anchor.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 70;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});
