<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 브랜치 규칙 (필수)

- `main`: 운영. Netlify Production 자동 배포. 직접 푸시 금지, PR 로만 머지.
  - 받을 수 있는 PR: `develop`(정기 배포), `hotfix/*`(긴급 수정)만. CI `build` + `source-branch` 통과 필수.
- `develop`: 개발 통합(기본 브랜치). Netlify 브랜치 배포(테스트 시트). 직접 푸시 금지, PR 로만 머지. CI `build` 통과 필수.
- 작업 브랜치: `feature/*`, `fix/*` 는 `develop` 에서 만들어 `develop` 으로 PR.
- `hotfix/*` 는 `main` 에서 만들어 `main` 으로 PR, 머지 후 `main` → `develop` 으로 반영 PR.
- `develop` → `main` 은 Merge commit 으로 머지 (squash 하면 두 브랜치 이력이 어긋남).
- 패키지 관리는 pnpm. `.env*`(예: `.env.example` 제외)·서비스 계정 키는 커밋 금지.
