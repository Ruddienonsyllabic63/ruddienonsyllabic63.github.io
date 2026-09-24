/* ==========================================================================
   사이트 설정 읽기 — 관리자가 켜고 끈 값을 방문자 쪽에서 확인합니다.

   읽기는 로그인 없이 가볍게 합니다(익명 계정을 만들지 않습니다).
   쓰기는 관리 페이지에서 API.setSetting() 으로 합니다.
   ========================================================================== */

/**
 * @param {string} key      설정 이름 (예: 'showProjectBudget')
 * @param {*}      fallback 값이 없을 때 돌려줄 기본값
 */
async function readSetting(key, fallback = null) {
  const CFG = window.SITE_CONFIG;

  // Supabase 를 아직 붙이지 않았으면 이 브라우저에만 저장된 값을 씁니다.
  if (!window.isSupabaseConfigured || !window.isSupabaseConfigured()) {
    try {
      const raw = localStorage.getItem('setting:' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  try {
    const url = `${CFG.supabase.url}/rest/v1/site_settings`
      + `?key=eq.${encodeURIComponent(key)}&select=value`;
    const res = await fetch(url, {
      headers: {
        apikey: CFG.supabase.anonKey,
        Authorization: `Bearer ${CFG.supabase.anonKey}`,
      },
    });
    if (!res.ok) return fallback;
    const rows = await res.json();
    return rows.length ? rows[0].value : fallback;
  } catch {
    return fallback;   // 설정을 못 읽어도 화면은 그대로 보여야 합니다
  }
}
