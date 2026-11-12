# 임대장부 (Next.js)

여러 건물·호실의 임대 계약과 월별 수납을 관리하는 웹앱입니다.
Next.js 16 · TypeScript · shadcn/ui(Base UI) · Tailwind CSS 4. 데이터는 구글 스프레드시트에 저장합니다.

## 화면

- **대시보드** `/`: 월별 청구·수납·지출·순수익(수납 − 지출)·미수금·납부 예정·입주율, 최근 6개월 수입·지출 표, 건물별 호실 현황판, 미납/납부 예정/계약 만료 목록
- **호실·계약** `/units`: 건물·유형·수납 상태 필터, 검색, 호실 상세(계약 조건·최근 6개월 수납·수납 기록), 계약 등록·수정·종료, 월세 선불/후불(후불은 입주 다음 달부터 지난 한 달 치 청구), 계약별 중개소·중개수수료(중개소 목록에서 선택하거나 계약 창에서 바로 추가, 수수료를 지출로 기록), 중개소 관리
- **수납 내역** `/payments`: 청구월별 입금 기록, 잘못 입력한 기록 삭제, 그달 보증금 입금·반환 기록
- **지출** `/expenses`: 건물별 정기 지출(공용전기·청소·인터넷+TV·수도 등)을 매달 금액 확인 후 한 번에 기록, 자주 쓰는 지출(소모품·점검 등)은 태그를 눌러 바로 기록(되돌리기 가능), 하자 보수 등 기타 지출 기록·수정·삭제
- **보증금**: 호실 상세에서 계약금·잔금 입금과 퇴실 후 반환을 기록. 입주 전후 미입금·퇴실 후 반환 대기는 대시보드 「보증금 확인」에 표시
- 휴대폰(768px 미만)에서는 하단 탭, 카드 목록, 아래에서 올라오는 상세·입력 시트로 바뀝니다.

청구 규칙: 월세 = 임대료 + 관리비, 전세 = 관리비만. 납부일이 지났는데 입금이 부족하면 미납(일부 입금은 일부 미납).
종료일이 지나도 「종료」 처리 전까지는 묵시적 갱신으로 보고 계속 청구하며 "갱신 필요"로 표시합니다.

## 바로 실행 (가짜 데이터)

패키지 관리는 **pnpm** 을 씁니다(`package.json` 의 `packageManager` 에 버전 고정). pnpm 이 없으면 `corepack enable` 로 켭니다.

```bash
pnpm install
pnpm dev           # http://localhost:3000
```

구글 시트 환경변수가 없으면 메모리의 가짜 데이터(Building A 13실 · Building B 19실, 임차인·연락처도 모두 가상)로 동작합니다(서버 재시작 시 초기화).
개발 모드에서 `AUTH_PASSWORD` 가 없으면 로그인 없이 열립니다. 운영(`next start`, 배포)에서는 반드시 필요합니다.

```bash
pnpm test          # Vitest 단위 테스트 (청구·선불/후불·보증금·수입지출·시트 값 정규화)
```

CI(PR·develop 푸시)는 `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build` 순서로 검사합니다.

## 구글 시트 연결

1. [Google Cloud 콘솔](https://console.cloud.google.com/)에서 프로젝트를 만들고 **Google Sheets API** 를 사용 설정합니다.
2. **IAM 및 관리자 → 서비스 계정** 에서 서비스 계정을 만들고, **키 → 키 추가 → JSON** 으로 키 파일을 받습니다.
3. 구글 드라이브에서 빈 스프레드시트를 만들고(예: `임대관리_DB`), **공유** 로 서비스 계정 이메일을 **편집자** 로 추가합니다.
   - 예전 Apps Script 버전으로 만든 시트가 있으면 그대로 써도 됩니다(탭 구성이 같습니다).
4. `.env.example` 을 `.env.local` 로 복사하고 값을 채웁니다.
   - `GOOGLE_SHEET_ID`: 시트 주소 `/d/` 와 `/edit` 사이 문자열
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`: JSON 키의 `client_email`, `private_key`
   - `AUTH_PASSWORD`(로그인 비밀번호), `AUTH_SECRET`(`openssl rand -hex 32` 결과)
5. 탭·머리글·호실을 만듭니다(이미 있는 데이터는 건드리지 않음).
   ```bash
   pnpm setup-sheet
   ```
   건물·호실은 예시(Building A 1층 3실·2~3층 각 5실 / Building B 1층 4실·2~4층 각 5실)로 들어갑니다.
   실제와 다르면 계약을 넣기 전에 시트 「건물」 탭의 건물명과 「호실」 탭의 호수·층을 고치세요.

시트 탭 구성

| 탭 | 열 |
|---|---|
| 건물 | 건물ID, 건물명, 주소, 메모 |
| 호실 | 호실ID, 건물ID, 호수, 층, 면적(㎡), 메모 |
| 계약 | 계약ID, 호실ID, 임차인, 연락처, 유형(월세/전세), 보증금, 월임대료, 관리비, 납부일, 시작일, 종료일, 상태(진행/종료), 메모, 등록일시, 중개소(저장 시점 이름), 중개수수료, 중개소ID, 납부방식(선불/후불, 빈칸은 선불) |
| 수납내역 | 수납ID, 계약ID, 호실ID, 청구월(YYYY-MM), 입금액, 입금일, 방법, 메모, 기록일시 |
| 보증금내역 | 보증금ID, 계약ID, 호실ID, 구분(계약금/잔금/반환), 금액, 일자, 방법, 메모, 기록일시 |
| 지출내역 | 지출ID, 건물ID, 귀속월(YYYY-MM), 항목, 금액, 지출일, 메모, 정기항목ID(정기 지출일 때), 기록일시 |
| 정기지출 | 정기항목ID, 건물ID, 항목, 기본금액, 메모 |
| 중개소 | 중개소ID, 이름, 연락처, 주소, 메모 |
| 자주쓰는지출 | 빠른항목ID, 건물ID, 항목, 기본금액(0이면 누를 때 입력), 메모(지출 메모로 같이 기록) |

보증금내역·지출내역·정기지출·자주쓰는지출·중개소 탭은 없어도 앱이 열리고, 처음 저장할 때 머리글과 함께 자동으로 만들어집니다. 계약 탭의 중개소·중개수수료·중개소ID·납부방식 열도 처음 계약을 저장할 때 머리글이 자동으로 붙습니다(`pnpm setup-sheet` 를 다시 실행해도 됩니다).
순수익은 청구월 기준 수납액에서 귀속월 기준 지출을 뺀 값이며, 보증금은 돌려줄 돈이라 수익에 넣지 않습니다.
보증금 미입금 알림은 입주 60일이 지나지 않은 진행 계약만 대상입니다(앱 도입 전 계약은 기록이 없어도 알리지 않음).

시트에서 직접 고친 내용은 앱의 새로고침 버튼(또는 페이지 이동)으로 반영됩니다.

앱이 저장하는 동안에는 숨김 탭 「_lock」 이 잠깐 생겼다 지워집니다. 여러 사람·기기가 동시에 저장해도 한 번에 하나씩 처리하기 위한 잠금이니 지우거나 고치지 마세요(서버가 중간에 멈춰 남은 잠금은 30초 뒤 자동 정리됩니다).
행을 지우거나 순서를 바꾸는 시트 직접 편집은 앱에서 저장하는 중이 아닐 때 하세요.

## 무료 배포 — Netlify 권장

Next.js 는 서버(서버 액션, 시트 API 호출)가 필요하므로 정적 호스팅이 아니라 Next.js 를 지원하는 곳이어야 합니다.

| 서비스 | 판단 |
|---|---|
| **Netlify 무료 플랜 (권장)** | Next.js 16 을 별도 설정 없이 배포, 상업적 이용 제한 없음. 월 사용량(크레딧)을 넘으면 멈추지만 혼자 쓰는 관리 앱은 여유 있음 |
| Vercel Hobby | Next.js 지원은 가장 좋지만 약관상 **비상업적 개인 용도만** 허용 → 임대업 관리에는 Pro(유료)가 원칙 |
| Cloudflare Workers (OpenNext) | 무료 한도 넉넉, 상업 이용 가능. 설정 단계가 더 많음 |

Netlify 배포 순서

1. 이 저장소를 GitHub 비공개 저장소로 둡니다(`.env.local` 은 올라가지 않습니다).
2. Netlify → **Add new site → Import an existing project** → 저장소 선택. 빌드 설정은 자동 감지됩니다(`pnpm-lock.yaml` 이 있으면 pnpm 으로 설치, 빌드 명령 `pnpm build`).
3. **Site configuration → Environment variables** 에 `.env.local` 의 5개 값을 그대로 넣고 다시 배포합니다.
   `GOOGLE_PRIVATE_KEY` 는 `\n` 이 포함된 한 줄 그대로 붙여넣으면 됩니다.
4. 나온 주소(`https://<이름>.netlify.app`)를 PC 즐겨찾기·휴대폰 홈 화면에 추가합니다.

임차인 이름·연락처가 들어가므로 `AUTH_PASSWORD` 없이 배포하지 마세요(설정이 없으면 운영 환경에서는 로그인이 불가능하게 막혀 있습니다).

## 브랜치 전략

`develop` → 기능 브랜치 → PR(→ develop) → 개발 완료 → PR(develop → main) → 운영 배포.
GitHub 무료 플랜이라 서버에서 강제되지 않으므로 로컬 훅과 CI, 아래 명령으로 지킵니다. 상세 규칙은 `AGENTS.md`.

| 브랜치 | 역할 | 배포 |
|---|---|---|
| `main` | 운영 | Netlify Production (실제 시트) |
| `develop` | 개발 통합 · 기본 브랜치 | Netlify 브랜치 배포 (테스트 시트) |
| `feature/*`, `fix/*` | 작업 | develop 으로 PR → Deploy Preview |
| `hotfix/*` | 긴급 수정 | main 에서 분기 → main 으로 PR → main → develop 반영 |

```bash
pnpm flow start payment-export   # develop 최신화 + feature/payment-export 생성
# … 작업·커밋 …
pnpm flow pr                     # 푸시 + develop 으로 PR (CI 통과 후 머지)
pnpm flow sync                   # develop 최신화, 머지된 브랜치 정리
pnpm flow release                # 개발 완료 시 develop → main PR (Merge commit 으로 머지)
```

## 구조

```
src/
  app/(app)/            대시보드·호실·수납 페이지 (Suspense 안에서 요청마다 시트 읽기)
  app/login/            비밀번호 로그인
  app/actions.ts        서버 액션: 수납 기록/삭제, 계약 저장/종료, 새로고침
  proxy.ts              로그인 쿠키 확인 (Next 16 의 middleware)
  lib/billing.ts        청구·수납 상태 계산
  lib/**/*.test.ts      Vitest 단위 테스트 (가상 데이터는 src/test/fixtures.ts)
  lib/data/             저장소: sheets-store(구글 시트 REST) / mock-store(가짜 데이터)
  components/rent/      화면 컴포넌트
  components/ui/        shadcn/ui 컴포넌트
scripts/setup-sheet.mjs 시트 초기 설정
```
