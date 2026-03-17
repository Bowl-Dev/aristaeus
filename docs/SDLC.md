# Aristaeus — Software Development Lifecycle (SDLC)

**Audience:** Incoming developers joining the Aristaeus project
**Last Updated:** 2026-03-16
**Project Status:** MVP Complete — transitioning to robot integration phase

---

## Related Docs

| Document                                                                        | Purpose                                                    |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`CLAUDE.md`](../CLAUDE.md)                                                     | Architecture, stack, deployment checklist, lessons learned |
| [`PROJECT_SPEC.md`](../PROJECT_SPEC.md)                                         | API contracts, business rules, database schema             |
| [`frontend/FRONTEND_IMPLEMENTATION.md`](../frontend/FRONTEND_IMPLEMENTATION.md) | Frontend architecture, component guide, state management   |

---

## 1. Introduction

This document defines how the Aristaeus team works — branching strategy, pull request process, sprint cadence, and onboarding steps. It is intentionally lightweight and adapted for a team of 1–2 developers.

The MVP (bowl builder frontend + Lambda backend + AWS infrastructure) is complete. The next development phase targets robot integration (ESP32 device communication, kitchen automation). All current endpoints are deployed and functional.

---

## 2. Roles & Responsibilities

### Tech Lead / Developer

- Final say on architecture decisions and technology choices
- Approves and merges pull requests
- Owns deployment approvals (Terraform apply, production releases)
- Escalates to external reviewers when decisions have significant risk or scope

### Developer

- Implements features, bug fixes, and tests
- Opens pull requests; ensures CI passes before requesting review
- Follows the deployment checklist in `CLAUDE.md` when adding endpoints or modifying schema

### Solo Setup

When one person fills both roles:

- Still open PRs — CI enforcement catches regressions even without a reviewer
- Seek external review (friend, community, AI pair programming) for:
  - Changes to Terraform infrastructure
  - Database schema migrations going to production
  - New Lambda handler wiring (6-file checklist)

---

## 3. Development Workflow

### 3.1 Branching Strategy (GitHub Flow)

`main` is always deployable. All work happens on short-lived branches.

| Branch prefix | When to use                 | Example                            |
| ------------- | --------------------------- | ---------------------------------- |
| `feature/`    | New functionality           | `feature/robot-heartbeat-ui`       |
| `fix/`        | Bug fixes                   | `fix/capacity-overflow-validation` |
| `chore/`      | Tooling, dependencies, docs | `chore/update-prisma-client`       |

Rules:

- Branch from `main`, merge back to `main` via PR
- Delete branches after merge
- Keep branches short-lived (days, not weeks)

### 3.2 Pull Request Process

Every change to `main` goes through a PR, even on a solo team.

**Opening a PR:**

- Title: concise description of what changed (`fix: prevent bowl capacity from going negative`)
- Body: short explanation of what and why; link to Linear/GitHub issue if one exists
- CI must be green before requesting review

**Review:**

- Solo: self-review the diff; confirm the change does exactly what was intended
- 2+ devs: at least one peer review before merge

**Merge:**

- Prefer **squash merge** to keep `main` history clean and linear
- Delete the branch after merge

### 3.3 Code Quality

Enforcement is automatic — you do not need to remember to run these manually.

| Gate             | When it runs          | What it checks                               |
| ---------------- | --------------------- | -------------------------------------------- |
| Husky pre-commit | On every `git commit` | ESLint (auto-fix) + Prettier on staged files |
| CI `lint.yml`    | On every PR           | ESLint + Prettier across full codebase       |

If the pre-commit hook fails, fix the reported issue before committing. Do not use `--no-verify` to bypass hooks.

### 3.4 Adding New API Endpoints

Follow the 6-file checklist from `CLAUDE.md`. All six must be updated for a new Lambda handler to work correctly in both local dev and CI-deployed production:

| File                              | Change required                                 |
| --------------------------------- | ----------------------------------------------- |
| `backend/src/handlers/<name>.ts`  | Handler implementation                          |
| `backend/src/dev-server.ts`       | Express route for local dev                     |
| `backend/scripts/build-lambda.sh` | Add to esbuild entry points **(CI uses this)**  |
| `backend/scripts/build-lambda.js` | Add to esbuild entry points (local builds)      |
| `backend/infra/lambda.tf`         | CloudWatch log group + Lambda function resource |
| `backend/infra/api_gateway.tf`    | Integration + Route + Lambda permission         |

**Critical:** CI uses `build-lambda.sh`. If you only update `build-lambda.js`, local builds succeed but CI-deployed production returns 500 errors.

### 3.5 Database Schema Changes

- **Local development:** `npm run db:push` is fine for iterating
- **Production:** Always create a migration file — `db:push` does not generate migrations

```bash
# Generate a migration from schema changes
npx prisma migrate dev --name descriptive_name
```

Commit the generated migration file in `backend/prisma/migrations/`. CI runs `npx prisma migrate deploy` automatically after Terraform apply.

Symptom of a missing migration: local works, production endpoints return 500 on anything touching new columns.

---

## 4. Sprint & Release Cycle

### 4.1 Sprint Cadence (Scrum-lite)

Two-week sprints. All ceremonies are lightweight — adapt durations to team size.

| Ceremony        | Cadence                  | Duration | Purpose                                                      |
| --------------- | ------------------------ | -------- | ------------------------------------------------------------ |
| Sprint Planning | Start of sprint (Monday) | ~1 hr    | Pull issues from backlog, set sprint goal, assign work       |
| Daily Standup   | Daily                    | 5–10 min | Progress, blockers — async (written) is fine for solo/remote |
| Sprint Review   | End of sprint (Friday)   | ~30 min  | Demo completed features; confirm against sprint goal         |
| Retrospective   | End of sprint            | ~20 min  | What worked, what to improve, update this doc if needed      |

For a solo developer, standups and retrospectives can be a written note to yourself (Linear comment, Notion entry, etc.).

### 4.2 Issue Tracking

Use **Linear** (already in use) or **GitHub Issues**. Whichever is chosen, keep a single backlog — don't split across both.

Label issues with:

- `type: feature`, `type: bug`, `type: chore`
- `area: frontend`, `area: backend`, `area: infra`
- Priority levels as needed (`p0` through `p2`)

### 4.3 Versioning

Semantic versioning: `MAJOR.MINOR.PATCH`

| Increment | When                                                      |
| --------- | --------------------------------------------------------- |
| `PATCH`   | Bug fixes, minor UI tweaks, dependency updates            |
| `MINOR`   | New endpoint, new UI feature, backward-compatible changes |
| `MAJOR`   | Breaking API changes, major architecture shifts           |

Current version: start at `1.0.0` (MVP complete).

### 4.4 Release Process

1. Merge feature branch → `main` via PR (CI must pass)
2. **Frontend** auto-deploys via GitHub Actions → GitHub Pages (no manual step)
3. **Backend** — review infrastructure changes, then deploy:
   - Triggered automatically by CI (`deploy-backend.yml`) on push to `main`, OR
   - Manually: `cd backend/infra && terraform apply`
4. Tag the release:
   ```bash
   git tag v1.1.0
   git push --tags
   ```
5. Add a GitHub release with a short changelog summary

---

## 5. Developer Onboarding Checklist

Complete these steps in order when joining the project.

### Access

- [ ] GitHub repo access granted (maintainer role)
- [ ] AWS IAM credentials or assume-role access configured
- [ ] Linear workspace invite sent and accepted
- [ ] Secrets received: `DATABASE_URL`, `VITE_API_URL`

### Local Environment

- [ ] Node.js 20+ and npm 10+ installed (`node -v`, `npm -v`)
- [ ] Docker Desktop installed and running
- [ ] Clone the repo:
  ```bash
  git clone <repo-url> && cd aristaeus
  ```
- [ ] Install dependencies:
  ```bash
  npm install
  ```
- [ ] Configure environment files:
  ```bash
  cp backend/.env.hosted.example backend/.env.hosted
  cp frontend/.env.hosted.example frontend/.env.hosted
  # Edit both files with the credentials you received
  ```
- [ ] Start the full local stack:
  ```bash
  npm run docker:up        # Start PostgreSQL in Docker
  npm run db:setup         # Push schema + seed data
  npm run dev:local        # Start frontend + backend
  ```
- [ ] Verify it works:
  - Frontend: `http://localhost:5173` — bowl builder UI loads
  - Backend: `http://localhost:3000/api/ingredients` — returns JSON ingredient list

### Knowledge Transfer

- [ ] Read `CLAUDE.md` — architecture decisions, deployment checklist, lessons learned
- [ ] Read `PROJECT_SPEC.md` — API contracts, business rules, order lifecycle, DB schema
- [ ] Read `frontend/FRONTEND_IMPLEMENTATION.md` — component structure, Svelte 5 runes patterns
- [ ] Run the backend test suite:
  ```bash
  npm run test:backend
  ```
- [ ] Complete one **starter task** as a practice PR (a small bug fix or documentation update). This validates your full workflow: branch → code → commit → CI → PR → merge.

### CI/CD Access

- [ ] Confirm GitHub Actions workflows appear and run on your PRs
- [ ] Verify required repo secrets are set in GitHub Settings → Secrets:
  - `AWS_ROLE_ARN`
  - `VITE_API_URL`
- [ ] Confirm you can view CloudWatch logs in the AWS console:
      `CloudWatch → Log groups → /aws/lambda/aristaeus-*`

---

## 6. Quick Reference

### Development Modes

| Mode          | Command                | Use when                              |
| ------------- | ---------------------- | ------------------------------------- |
| Full local    | `npm run dev:local`    | Default daily dev (Docker DB)         |
| Hybrid        | `npm run dev:hybrid`   | Local backend + hosted DB             |
| Frontend only | `npm run dev:frontend` | UI work only, uses production backend |

### Common Commands

```bash
npm run lint             # Run ESLint across all workspaces
npm run lint:fix         # ESLint with auto-fix
npm run format           # Prettier format all files
npm run db:generate      # Regenerate Prisma client after schema changes
npm run db:studio        # Open Prisma Studio GUI
npm run build            # Build frontend for GitHub Pages
npm run build:backend    # Build Lambda zip for deployment
```

### Getting Help

- Architecture questions → `CLAUDE.md`
- API/business logic questions → `PROJECT_SPEC.md`
- Frontend component questions → `frontend/FRONTEND_IMPLEMENTATION.md`
- Production issues → CloudWatch logs (`/aws/lambda/aristaeus-*`)
- Past decisions → `git log` and PR history
