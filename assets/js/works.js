/* ==========================================================================
   결과물 카드 그리기 — 갤러리와 관리 페이지가 함께 씁니다.
   ========================================================================== */

const ICONS = {
  pdf: '📕', hwp: '📄', hwpx: '📄', doc: '📄', docx: '📄', txt: '📄', md: '📄',
  ppt: '📊', pptx: '📊', key: '📊',
  xls: '📗', xlsx: '📗', csv: '📗',
  zip: '🗜️',
  link: '🔗', etc: '📎',
};

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'svg'];

function extOf(name) {
  return String(name || '').split('.').pop().toLowerCase();
}

function isImage(row) {
  return IMAGE_EXT.includes(extOf(row.file_name));
}

/** 유튜브 주소면 미리보기 이미지를 만들어 줍니다. */
function youtubeThumb(url) {
  const m = String(url || '').match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

function thumbHtml(row) {
  if (isImage(row) && row.file_url) {
    return `<img src="${esc(row.file_url)}" alt="" loading="lazy">`;
  }
  if (row.link_url) {
    const yt = youtubeThumb(row.link_url);
    if (yt) return `<img src="${esc(yt)}" alt="" loading="lazy">`;
    return ICONS.link;
  }
  if (row.file_name) return ICONS[extOf(row.file_name)] || ICONS.etc;
  return ICONS.etc;
}

/** 열어 보기 단추 */
function openButton(row) {
  if (row.link_url) {
    return `<a class="btn btn--ghost btn--sm" href="${esc(row.link_url)}" target="_blank" rel="noopener">링크 열기</a>`;
  }
  if (row.file_url) {
    return `<a class="btn btn--ghost btn--sm" href="${esc(row.file_url)}" target="_blank" rel="noopener">파일 보기</a>`;
  }
  if (row.file_name) {
    return `<span class="small muted">${esc(row.file_name)}</span>`;
  }
  return '';
}

/**
 * 결과물 카드 한 장.
 * @param {Object} row
 * @param {Object} [opt]
 * @param {boolean} [opt.admin]  관리자 조작 단추를 함께 그릴지
 * @param {string}  [opt.courseTitle] 과목 이름을 함께 보여 줄 때
 */
function workCard(row, opt = {}) {
  const badge = row.visibility === 'public'
    ? '<span class="badge-public">모두 공개</span>'
    : row.visibility === 'private'
      ? '<span class="badge-class">비공개</span>'
      : '<span class="badge-class">수업 공개</span>';

  const size = row.file_size ? ` · ${fmtSize(row.file_size)}` : '';

  const adminControls = opt.admin ? `
    <div class="work__foot" style="border-top:1px solid var(--line-soft); margin-top:.5rem">
      <select class="vis-select" data-id="${esc(row.id)}" aria-label="공개 범위 바꾸기"
              style="width:auto; padding:.28rem .5rem; font-size:.82rem">
        <option value="class"   ${row.visibility === 'class' ? 'selected' : ''}>수업 공개</option>
        <option value="public"  ${row.visibility === 'public' ? 'selected' : ''}>모두 공개</option>
        <option value="private" ${row.visibility === 'private' ? 'selected' : ''}>비공개</option>
      </select>
      <button class="btn btn--sm btn--danger del-btn" data-id="${esc(row.id)}" type="button">삭제</button>
    </div>` : '';

  return `
  <article class="work">
    <div class="work__thumb">${thumbHtml(row)}</div>
    <div class="work__body">
      ${opt.courseTitle ? `<span class="small" style="color:var(--gold); font-weight:700">${esc(opt.courseTitle)}</span>` : ''}
      <h3 class="work__title">${esc(row.title)}</h3>
      <p class="work__by">${esc(row.author_name)}${row.student_no ? ` · ${esc(row.student_no)}` : ''} · ${esc(fmtDate(row.created_at))}</p>
      ${row.description ? `<p class="work__desc">${esc(row.description)}</p>` : ''}
      <div class="work__foot">
        ${badge}
        <span class="small muted">${esc(row.file_name || (row.link_url ? '링크' : ''))}${esc(size)}</span>
      </div>
      <div class="work__foot" style="padding-top:.3rem">${openButton(row)}</div>
      ${adminControls}
    </div>
  </article>`;
}
