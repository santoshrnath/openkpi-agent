# Deploying OpenKPI Studio to Hetzner

Public hostname: **<https://openstudio.oneplaceplatform.com>**

This doc explains:

1. How the secrets stay out of GitHub
2. How to deploy from your laptop in one command
3. How the runtime works on the Hetzner box (Coolify + Traefik)
4. How to roll back / tail logs / restart

---

## 1. How secrets stay out of GitHub

There are three env files in the OpenKPI project; only one is public.

| File              | Where it lives        | In git?           | What it holds                       |
| ----------------- | --------------------- | ----------------- | ----------------------------------- |
| `.env.example`    | Repo root             | ✅ Committed       | Placeholder template — no real keys |
| `.env.local`      | Your laptop only      | ❌ git-ignored     | Real keys for local `npm run dev`   |
| `.env`            | Hetzner server only   | ❌ git-ignored     | Real keys at runtime (copied via scp) |

The repo's [`.gitignore`](../.gitignore) blocks every `.env*` variant **except** `.env.example`:

```gitignore
.env*
!.env.example
```

Verify it for yourself:

```bash
git check-ignore -v .env.local      # → .gitignore:26:.env*  .env.local
git check-ignore -v .env.example    # → .gitignore:27:!.env.example .env.example  (whitelisted)
```

The deploy script ([`deploy/hetzner/deploy.sh`](../deploy/hetzner/deploy.sh)) also defensively `--exclude ".env*"` from the `rsync`, so even if you accidentally added a stray `.env.something` file in your working tree, it would never reach the server (the script does an explicit `scp` of just `.env.local` → `.env` on the server, in a separate step).

**Net effect:** the only place a real Anthropic / OpenAI / Azure key lives is (a) your laptop's `.env.local`, and (b) the server's `/opt/openkpi-studio/.env`. Never git.

---

## 2. Deploying from your laptop

### One-time setup

1. On your **laptop**, copy the env template and fill in your keys:
   ```bash
   cp .env.example .env.local
   # edit .env.local — at minimum:
   #   OPENKPI_AI_PROVIDER=anthropic
   #   ANTHROPIC_API_KEY=sk-ant-...
   #   PUBLIC_HOSTNAME=openstudio.oneplaceplatform.com
   ```

2. Make sure your **Hetzner** box has Docker installed and the shared `coolify` Traefik network running (it already does — that's how `finance.oneplaceplatform.com` is served).

3. Point a DNS A-record for `openstudio.oneplaceplatform.com` at your Hetzner box's public IP.

### Deploy

From the project root on your laptop:

```bash
OPENKPI_SSH_HOST=root@<your-hetzner-ip> ./deploy/hetzner/deploy.sh
```

That single command:

1. `rsync`s the source tree to `/opt/openkpi-studio` (excluding `node_modules`, `.next`, `.git` and every `.env*` file).
2. `scp`s your local `.env.local` to the server as `.env`.
3. SSH-runs `docker compose up -d --build` on the server.
4. Prints both the Traefik-routed URL and the direct host-port URL.

First build takes ~3 minutes. Subsequent deploys (no dep changes) take ~30 seconds.

### Custom port

The default host port is `3050`. Override with:

```bash
OPENKPI_SSH_HOST=root@1.2.3.4 OPENKPI_PORT=3070 ./deploy/hetzner/deploy.sh
```

---

## 3. How the runtime works on Hetzner

```
                    DNS A-record
   openstudio.oneplaceplatform.com  →  Hetzner public IP
                                          │
                                          ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Coolify-managed Traefik (shared, already running)        │
   │  • Listens on :80 and :443                               │
   │  • LetsEncrypt via http-01 challenge                     │
   │  • Routes by Docker label                                │
   └──────────────────────────────────────────────────────────┘
                                          │
                                          ▼   (coolify network)
   ┌──────────────────────────────────────────────────────────┐
   │ openkpi-studio-app   (port 3000 inside)                  │
   │  • Next.js standalone server                             │
   │  • Reads ANTHROPIC_API_KEY from /opt/openkpi-studio/.env │
   │  • Non-root user, dumb-init PID 1                        │
   └──────────────────────────────────────────────────────────┘
```

The Traefik labels live in [`docker-compose.yml`](../docker-compose.yml). They tell the *existing* shared Traefik (the one Coolify set up for `finance.oneplaceplatform.com`) to also route `openstudio.oneplaceplatform.com` to this container.

Port 3050 on the host is also published as a smoke-test backdoor (`http://<server>:3050`). You can comment that line out in `docker-compose.yml` once you're happy with the Traefik routing.

---

## 4. Operations

```bash
# Tail logs
ssh root@<server> 'cd /opt/openkpi-studio && docker compose logs -f'

# Restart without rebuild
ssh root@<server> 'cd /opt/openkpi-studio && docker compose restart'

# Pull latest from laptop + rebuild
OPENKPI_SSH_HOST=root@<server> ./deploy/hetzner/deploy.sh

# Rotate the API key (on the server, never via git)
ssh root@<server>
  cd /opt/openkpi-studio
  nano .env                       # change ANTHROPIC_API_KEY=...
  docker compose up -d            # picks up new env on the next container start

# Roll back to a previous commit
ssh root@<server>
  cd /opt/openkpi-studio
  git -C ./ checkout <previous-sha>   # only if you keep a server-side clone
# OR just re-run deploy.sh from a previous laptop checkout
```

---

## 5. If you accidentally commit a key

It happens. If you do:

1. **Rotate the key immediately** in the provider's console (Anthropic / OpenAI). The committed key is now public — it will be scraped within minutes.
2. Remove the key from the file and commit the fix.
3. Optionally rewrite history: `git filter-repo --invert-paths --path .env.local --force` then `git push --force`. (Anyone who already cloned has the old object, so step 1 is the only thing that actually matters.)

The current `.gitignore` makes this hard to do by accident, and the deploy script doesn't `rsync` env files. But the rule of thumb is: **rotate first, fix history later**.
