/* ==========================================================================
   공통 스크립트 — 모든 페이지에서 불러옵니다.
   메뉴 열기/닫기, 밝은·어두운 모드, 자잘한 도우미 함수
   ========================================================================== */

/* ---------- 도우미 ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** HTML 특수문자를 안전하게 바꿉니다(사용자 입력을 화면에 넣을 때 필수). */
function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** 주소창의 ?이름=값 을 읽습니다. */
function param(name, fallback = '') {
  return new URLSearchParams(location.search).get(name) ?? fallback;
}

/** 2026-09-24T... → 2026.09.24 */
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

/** 770000000 → "7억 7,000만 원" */
function fmtMoney(won) {
  const n = Number(won);
  if (!n) return '';
  const eok = Math.floor(n / 100000000);
  const man = Math.floor((n % 100000000) / 10000);
  const parts = [];
  if (eok) parts.push(`${eok}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  if (!parts.length) return `${n.toLocaleString('ko-KR')}원`;
  return parts.join(' ') + ' 원';
}

/** "2026-06-30" → "2026.06" */
function fmtMonth(iso) {
  if (!iso) return '';
  const [y, m] = String(iso).split('-');
  return m ? `${y}.${m}` : y;
}

/** 1536000 → 1.5MB */
function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = Number(bytes), i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)}${units[i]}`;
}

/** 브라우저 저장소는 사생활 보호 모드에서 막힐 수 있어 항상 감싸 씁니다. */
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* 무시 */ } },
  del(key) { try { localStorage.removeItem(key); } catch { /* 무시 */ } },
};

/* ---------- 밝은 / 어두운 모드 ---------- */
function applyTheme(mode) {
  if (mode === 'light' || mode === 'dark') {
    document.documentElement.setAttribute('data-theme', mode);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}
applyTheme(store.get('theme')); // 깜빡임을 줄이려 즉시 적용

function currentTheme() {
  const saved = store.get('theme');
  if (saved) return saved;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/* ---------- 헤더 동작 ---------- */
function initHeader() {
  // 현재 페이지 메뉴에 표시
  const here = location.pathname.split('/').pop() || 'index.html';
  $$('.nav a').forEach((a) => {
    const target = a.getAttribute('href')?.split('?')[0].split('/').pop();
    if (target && target === here) a.setAttribute('aria-current', 'page');
  });

  // 모바일 메뉴
  const toggle = $('.nav-toggle');
  const nav = $('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') nav.classList.remove('is-open');
    });
  }

  // 밝은/어두운 모드 단추
  const themeBtn = $('.theme-toggle');
  if (themeBtn) {
    const paint = () => {
      const dark = currentTheme() === 'dark';
      themeBtn.textContent = dark ? '☀' : '☽';
      themeBtn.setAttribute('aria-label', dark ? '밝은 모드로 전환' : '어두운 모드로 전환');
      themeBtn.title = dark ? '밝은 모드로 전환' : '어두운 모드로 전환';
    };
    paint();
    themeBtn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      store.set('theme', next);
      applyTheme(next);
      paint();
    });
  }

  // 올해 연도 자동 표기
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
}

document.addEventListener('DOMContentLoaded', initHeader);
