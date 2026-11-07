#!/bin/sh
# 브랜치 전략 도우미:  develop → 기능 브랜치 → PR(develop) → 개발 완료 → PR(develop → main)
#   pnpm flow start <이름>          develop 최신화 후 feature/<이름> 생성
#   pnpm flow start fix/<이름>      버그 수정 브랜치 (fix/)
#   pnpm flow start hotfix/<이름>   운영 긴급 수정 (main 에서 분기 → main 으로 PR)
#   pnpm flow pr                    현재 브랜치 푸시 + develop 으로 PR (hotfix 는 main)
#   pnpm flow release               개발 완료: develop → main PR (운영 배포)
#   pnpm flow backport              hotfix 반영 후 main → develop PR
#   pnpm flow sync                  develop 최신화 + 머지된 로컬 브랜치 정리
set -e
cmd=$1; shift 2>/dev/null || true
cur=$(git branch --show-current)
die() { echo "✗ $*" >&2; exit 1; }
clean() { [ -z "$(git status --porcelain)" ] || die "커밋하지 않은 변경이 있습니다. 먼저 커밋하거나 stash 하세요."; }

case "$cmd" in
  start)
    [ -n "$1" ] || die "사용법: pnpm flow start <이름>  (예: pnpm flow start payment-export)"
    case "$1" in feature/*|fix/*|hotfix/*) name=$1 ;; *) name="feature/$1" ;; esac
    case "$name" in *" "*) die "브랜치 이름에 공백을 쓸 수 없습니다." ;; esac
    clean
    base=develop; case "$name" in hotfix/*) base=main ;; esac
    git fetch -q origin
    git switch -q "$base" && git pull -q --ff-only origin "$base"
    git switch -c "$name"
    echo "✓ $base 에서 $name 생성. 작업·커밋 후: pnpm flow pr"
    ;;
  pr)
    case "$cur" in feature/*|fix/*) base=develop ;; hotfix/*) base=main ;;
      *) die "작업 브랜치(feature/*, fix/*, hotfix/*)에서 실행하세요. 현재: $cur" ;; esac
    clean
    git push -u origin "$cur"
    gh pr create --base "$base" --head "$cur" --fill-first
    echo "✓ $cur → $base PR 생성. CI(build) 통과와 Deploy Preview 확인 후 머지하세요."
    ;;
  release)
    clean
    git fetch -q origin
    [ -n "$(git log --oneline origin/main..origin/develop)" ] || die "develop 에 main 보다 새로운 커밋이 없습니다."
    echo "운영에 나갈 변경:"; git log --oneline origin/main..origin/develop
    gh pr create --base main --head develop --title "release: $(date +%Y-%m-%d) 운영 배포" \
      --body "develop → main 운영 배포. CI(build, source-branch) 통과 확인 후 **Merge commit** 으로 머지하세요 (squash 금지)."
    ;;
  backport)
    git fetch -q origin
    [ -n "$(git log --oneline origin/develop..origin/main)" ] || die "main 에만 있는 커밋이 없습니다."
    gh pr create --base develop --head main --title "chore: main(hotfix) → develop 반영" --body "hotfix 를 develop 에 반영합니다."
    ;;
  sync)
    clean
    git fetch -q --prune origin
    git switch -q develop && git pull -q --ff-only origin develop
    git branch --merged develop | grep -E '^\s+(feature|fix|hotfix)/' | xargs -r git branch -d
    # squash 머지로 원격에서 지워진 브랜치도 정리
    git branch -vv | awk '/: gone]/{print $1}' | grep -E '^(feature|fix|hotfix)/' | xargs -r git branch -D
    echo "✓ develop 최신화, 머지된 로컬 브랜치 정리 완료"
    ;;
  *) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
