# 박주현 교수 웹사이트

전남대학교 문헌정보학과 박주현 부교수 개인 홈페이지 + 수업 결과물 공유 공간입니다.

- **소개·연구**: 약력, 연구 관심, 학술논문 46편·저역서 12권(주제별 검색), 연구 과제, 특강
- **수업**: 이번 학기 과목, 부임 이후 학기별 강의 이력, 과목별 누적, 주차별 계획
- **결과물**: 학생이 파일·링크로 제출 → 수업 코드를 아는 사람만 열람, 원하면 전체 공개
- **설문**: 구글 폼 연결
- **관리**: 교수용 화면에서 공개 범위 전환·삭제·CSV 내려받기

빌드 도구 없이 순수 HTML·CSS·JavaScript로 만들었습니다. 파일을 고치고 GitHub에 올리면 바로 반영됩니다.

---

## ⚠️ `제공 자료/` 폴더는 올리지 마세요

원본 증명서·엑셀·시간표를 두는 `제공 자료/` 폴더에는 **개인정보가 들어 있습니다.**
`.gitignore` 에 등록해 두어 git 으로 올릴 때는 자동으로 빠집니다.

> **GitHub 웹사이트에서 파일을 끌어다 놓는 방식으로 올리면 `.gitignore` 가 작동하지 않습니다.**
> 그 방식으로 올릴 때는 `제공 자료` 폴더를 빼고 나머지만 선택해 주세요.

자세한 내용은 그 폴더 안의 `읽어주세요-보안.md` 를 보세요(이 파일도 공개되지 않습니다).

사이트에 실제로 올라가는 것은 `data/*.json` 으로 간추린 내용뿐입니다.

---

## 1. 내 컴퓨터에서 미리 보기

이 폴더에서 아래 명령 하나면 됩니다.

```bash
python -m http.server 5173
```

그다음 브라우저에서 `http://localhost:5173` 을 엽니다.

> 파일을 더블클릭해서 열면(`file://`) 논문 목록·과목 목록이 뜨지 않습니다.
> 반드시 위 명령으로 띄워서 보세요.

---

## 2. 어디를 고치면 무엇이 바뀌나

| 고칠 파일 | 바뀌는 곳 |
|---|---|
| `data/publications.json` | 연구 페이지의 논문 목록 — **직접 고치지 마세요**(아래 참고) |
| `data/books.json` | 연구 페이지의 저역서 목록 — **직접 고치지 마세요**(아래 참고) |
| `data/teaching.json` | 이번 학기·강의 이력·과목별 누적 — **직접 고치지 마세요**(아래 참고) |
| `data/courses.json` | 과목 상세 안내(소개글·학습목표·주차 계획·결과물 제출) |
| `data/projects.json` | 연구 페이지의 연구 과제 (사업비 표시 여부도 여기서) |
| `data/surveys.json` | 설문 페이지의 구글 폼 목록 |
| `about.html` | 소개 글, 약력, 학회 활동 |
| `research.html` | 특강·발표 목록 |
| `assets/css/style.css` 맨 위 `:root` | 사이트 전체 색 |
| `assets/js/config.js` | Supabase 연결 정보, 파일 크기·형식 제한 |
| `assets/js/layout.js` | 모든 페이지 아래쪽 꼬리말(연락처 등) |

`about.html` 안에 `▼▼ 확인 후 실제 내용으로 바꿔 주세요 ▼▼` 라고 표시된 부분이
하나 남아 있습니다(학회·자문 활동). 그 자리를 채워 주세요.

**관리 페이지(`/admin.html`)의 '사이트 설정'** 에서 켜고 끌 수 있는 것이 둘 있습니다.

- **연구 과제 사업비 금액 공개** — 끄면 과제별 금액과 총 연구비가 사라집니다.
- **강의 이력의 수강생 수 공개** — 기본 꺼짐. 켜면 학기별 수강 인원과 누적 수강생이 나타납니다.

두 설정 모두 Supabase 에 저장되어 모든 방문자에게 같이 적용됩니다.
(Supabase 연결 전에는 그 브라우저에만 적용됩니다.)

**프로필 사진**은 `assets/img/profile.jpg` 로 넣으면 첫 화면에 자동으로 들어갑니다.

### 논문·저역서 목록 새로 고치기

논문과 저역서는 KCI 자료에서 자동으로 만듭니다. 논문이 새로 실리면 이렇게 하세요.

1. [KCI 저자 상세 페이지](https://www.kci.go.kr/)에 로그인 → 오른쪽 위 **엑셀** 단추를 눌러 파일을 받습니다.
2. 받은 파일을 `제공 자료/` 폴더에 넣습니다.
3. 아래 명령을 실행합니다.

```bash
python tools/import-kci.py
```

`data/publications.json` 과 `data/books.json` 이 새로 만들어집니다.
주제 분류가 어긋난 논문이 있으면 실행 결과에 이름이 나오니,
`tools/import-kci.py` 의 `THEME_OVERRIDE` 에 그 제목을 적어 주세요.

> `제공 자료/` 폴더는 `.gitignore` 에 등록되어 GitHub에 올라가지 않습니다.
> 원본 엑셀·강의시간표처럼 사이트에 직접 올리지 않을 재료를 여기에 둡니다.

### 새 학기 강의 기록 쌓기

수업 페이지의 **이번 학기 · 학기별 강의 이력 · 과목별 누적**은 강의시간표 PDF에서
자동으로 만듭니다. 학기가 바뀌면 이렇게 하세요.

1. 학교 포털에서 그 학기 **강의시간표를 PDF로 내려받습니다.**
2. `제공 자료/박주현 강의계획서나 시간표/` 폴더에 넣습니다.
   파일 이름에 연도와 학기가 들어 있으면 됩니다. (예: `박주현 2027년 1학기 강의시간표.pdf`)
3. 아래 명령을 실행합니다.

```bash
python tools/import-timetable.py
```

새 학기가 이력 맨 위에 쌓이고, 통계(학기 수·과목 수·누적 수강생)도 함께 갱신됩니다.
**이전 학기 자료를 지울 필요가 없습니다.** 폴더에 쌓아 두기만 하면 됩니다.

과목에 소개글·학습목표·주차 계획을 붙이거나 결과물 제출을 열려면
`data/courses.json` 에 항목을 하나 만들고 `code`(교과목 코드)와 `semester`를
시간표와 똑같이 적으면 됩니다. 그러면 그 과목 카드에 단추가 생깁니다.

---

## 3. GitHub Pages에 올리기

1. [github.com](https://github.com) 에 가입하고 새 저장소(repository)를 만듭니다.
   - 이름: `parkjuhyun.github.io` 로 하면 주소가 `https://parkjuhyun.github.io` 가 됩니다.
   - 다른 이름(`homepage` 등)으로 하면 `https://<아이디>.github.io/homepage/` 가 됩니다.
   - **Public**(공개)으로 만들어야 GitHub Pages를 무료로 쓸 수 있습니다.
2. 이 폴더의 파일을 모두 올립니다. (드래그 앤 드롭으로도 됩니다)
3. 저장소 → **Settings** → **Pages** → Source 를 `Deploy from a branch`,
   Branch 를 `main` / `/ (root)` 로 맞추고 저장합니다.
4. 1~2분 뒤 주소가 열립니다.

이후에는 파일을 고쳐 올릴 때마다 사이트가 자동으로 새로 만들어집니다.

---

## 4. Supabase 연결하기

연결하기 전에는 **데모 모드**로 돌아갑니다. 결과물을 올려도 그 브라우저에만
저장되고 다른 사람에게는 보이지 않습니다. 화면을 시험해 보기에는 충분합니다.

실제로 쓰려면 아래 순서대로 하세요. 처음 한 번만 하면 됩니다.

### 4-1. 프로젝트 만들기

1. [supabase.com](https://supabase.com) 에서 **Start your project** → GitHub 계정으로 로그인.
2. **New project** 를 누르고
   - Name: `parkjuhyun-site` (아무 이름이나)
   - Database Password: 길게 만들어 **따로 적어 둡니다** (나중에 필요할 수 있음)
   - Region: `Northeast Asia (Seoul)` 을 고르면 가장 빠릅니다.
3. 1~2분 기다리면 준비가 끝납니다.

### 4-2. 익명 접속 켜기

**Authentication** → **Sign In / Providers** → **Anonymous sign-ins** 를 켭니다.

> 수업 코드를 푼 사람과 안 푼 사람을 구분하기 위한 장치입니다.
> 학생이 회원가입을 해야 한다는 뜻이 아닙니다.

### 4-3. 데이터베이스 만들기

1. 왼쪽 메뉴 **SQL Editor** → **New query**.
2. 이 폴더의 `supabase/schema.sql` 파일 내용을 **전부 복사해 붙여 넣고** `Run`.
3. 초록색으로 성공 표시가 나오면 됩니다.

### 4-4. 관리자 계정 만들기

1. **Authentication** → **Users** → **Add user** → **Create new user**.
   - Email: `park51566@jnu.ac.kr`
   - Password: 직접 정합니다 (관리 페이지 로그인에 씁니다)
   - **Auto Confirm User** 를 켜 주세요.
2. 다시 **SQL Editor** 에서 아래를 실행합니다.

```sql
insert into public.admins (user_id, email)
select id, email from auth.users where email = 'park51566@jnu.ac.kr'
on conflict (user_id) do nothing;
```

### 4-5. 과목과 수업 코드 등록

`data/courses.json` 에 적은 `id` 와 **똑같이** 넣어야 합니다.

```sql
insert into public.courses (id, title, term, code_hash)
values ('ai-reading-2026-2', 'AI독서리터러시', '2026학년도 2학기', 'x')
on conflict (id) do update set title = excluded.title, term = excluded.term;

select public.set_course_code('ai-reading-2026-2', '실제수업코드');
```

과목마다 위 두 줄을 반복합니다. 수업 코드는 6자 이상으로 정하고,
수업 시간에만 알려 주세요. (코드는 암호화되어 저장되므로 나중에 다시 볼 수 없습니다.
잊었으면 `set_course_code` 로 새로 정하면 됩니다.)

### 4-6. 사이트에 연결

**Project Settings** → **API** 에서 두 값을 복사해 `assets/js/config.js` 에 넣습니다.

```js
supabase: {
  url: 'https://여기에프로젝트주소.supabase.co',
  anonKey: 'eyJhbGciOi... 로 시작하는 긴 문자열',
},
```

> `anon` / `public` 키를 넣으세요. 브라우저에 공개되는 것이 정상인 키입니다.
> **`service_role` 키는 절대 넣으면 안 됩니다.** 그 키는 모든 규칙을 통과합니다.

파일을 GitHub에 올리면 실제 저장으로 바뀝니다.

---

## 5. 방학 중 잠김 막기

Supabase 무료 플랜은 **7일 동안 아무 접속이 없으면 프로젝트가 일시정지**됩니다.
학기 중에는 문제가 없지만 방학에는 사이트가 안 열릴 수 있습니다.

이 폴더의 `.github/workflows/keep-supabase-awake.yml` 이 **3일에 한 번 자동으로
접속해서** 잠기지 않게 해 줍니다. 쓰려면 GitHub 저장소에서 값 두 개를 등록하세요.

**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| 이름 | 값 |
|---|---|
| `SUPABASE_URL` | `https://...supabase.co` |
| `SUPABASE_ANON_KEY` | anon 키 |

---

## 6. 자주 하는 일

**새 학기 시작할 때**
1. 강의시간표 PDF를 `제공 자료/박주현 강의계획서나 시간표/` 에 넣고
   `python tools/import-timetable.py` 를 실행합니다. → 이번 학기와 이력이 갱신됩니다.
2. 결과물 제출을 열 과목만 `data/courses.json` 에 항목을 만듭니다
   (`code`·`semester`를 시간표와 똑같이).
3. Supabase SQL Editor 에서 4-5 의 두 줄을 그 과목 `id` 로 실행합니다.

**수업 코드 바꾸기**
```sql
select public.set_course_code('ai-reading-2026-2', '새코드');
```

**제출 마감**
```sql
update public.courses set is_open = false where id = 'ai-reading-2026-2';
```

**설문 추가** — `data/surveys.json` 에 구글 폼 주소를 적습니다.
`embed: true` 로 두면 페이지 안에 설문이 펼쳐집니다.

**제출물 관리** — 사이트의 `/admin.html` 에서 로그인하면 공개 범위 전환, 삭제,
CSV 내려받기를 할 수 있습니다. 꼬리말의 '관리자' 링크로도 갈 수 있습니다.

---

## 7. 파일 구조

```
index.html          첫 화면
about.html          소개
research.html       연구 (논문 검색·필터)
courses.html        수업 목록
course.html         과목 상세 (?id=과목id)
gallery.html        결과물 갤러리 (?course=과목id)
upload.html         결과물 제출
admin.html          교수용 관리
surveys.html        설문

assets/css/style.css   전체 디자인
assets/js/config.js    ★ 설정 (Supabase 키 등)
assets/js/common.js    공통 도우미, 다크모드, 메뉴
assets/js/layout.js    공통 꼬리말
assets/js/api.js       데이터 계층 (Supabase / 데모 전환)
assets/js/works.js     결과물 카드 그리기
assets/js/gallery.js   갤러리 화면
assets/js/upload.js    제출 화면
assets/js/admin.js     관리 화면

data/publications.json 논문 목록   (자동 생성)
data/books.json        저역서 목록 (자동 생성)
data/teaching.json     강의 이력   (자동 생성)
data/projects.json     연구 과제
data/courses.json      과목 상세 안내
data/surveys.json      설문 목록

tools/import-kci.py       KCI 엑셀 → 논문·저역서 목록
tools/import-timetable.py 강의시간표 PDF → 강의 이력

supabase/schema.sql    데이터베이스 설계 (한 번 실행)
```
