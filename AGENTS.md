<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 브랜치 규칙 (필수 — GitHub 서버 보호 없이 운영하므로 반드시 지킬 것)

흐름: `develop` → 기능 브랜치 → PR(→ develop) → 개발 완료 → PR(develop → main) → 운영 배포

| 단계 | 명령 |
|---|---|
| 기능 시작 | `pnpm flow start <이름>` (develop 최신화 후 `feature/<이름>`; 버그는 `fix/<이름>`) |
| 기능 PR | `pnpm flow pr` → CI `build` 통과 + Deploy Preview 확인 후 develop 에 머지(squash 가능) |
| 정리 | `pnpm flow sync` |
| 운영 배포 | `pnpm flow release` → develop → main PR, CI `build`·`source-branch` 통과 후 **Merge commit** 으로 머지 |
| 긴급 수정 | `pnpm flow start hotfix/<이름>` → `pnpm flow pr`(→ main) → 머지 후 `pnpm flow backport`(main → develop) |

- `main`(운영, Netlify Production)·`develop`(기본 브랜치, 개발 통합)에는 직접 커밋·푸시하지 않는다.
  로컬 훅(`.githooks`)이 막는다: pre-commit(main·develop 커밋 금지), pre-push(main·develop 푸시 금지, 브랜치 이름은 feature/ fix/ hotfix/).
  훅이 꺼져 있으면 `pnpm run prepare` (`git config core.hooksPath .githooks`).
- GitHub 는 무료 플랜이라 머지를 서버에서 막지 않는다. 머지 전에 CI 결과를 반드시 확인하고, CI 가 실패한 PR 은 머지하지 않는다.
- `main` 으로 가는 PR 은 `develop` 또는 `hotfix/*` 에서만 (CI `source-branch` 가 검사).
- 운영 배포는 Netlify 무료 크레딧(배포 1회 15크레딧)을 쓰므로 기능마다가 아니라 묶어서 release 한다.
- 코드 리뷰: PR 을 만들면 herdr 옆 패널의 Codex 리뷰어(`rent-reviewer`, GPT-6.1-Sol medium, 읽기 전용)에게 리뷰를 요청한다.
  리뷰어는 파일 수정·커밋·머지·승인을 하지 않고 발견사항과 `판정: 머지 가능|수정 필요` 만 낸다.
  지적 사항을 반영하면 다시 리뷰를 요청한다. **최종 승인과 머지는 사용자가 한다.**
- AI 에이전트는 사용자 승인 없이 PR 을 머지하지 않는다.
- 패키지 관리는 pnpm. `.env*`(`.env.example` 제외)·서비스 계정 키는 커밋 금지.
