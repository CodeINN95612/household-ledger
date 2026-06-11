# Deployment (Dokploy)

This app is deployed through **Dokploy** as a **Docker Compose** service. Dokploy's
built-in **Traefik** handles routing and TLS — there is no Caddy/nginx and no host
port mapping. The compose file (`docker/docker-compose.yml`) is deliberately
**deployment-agnostic**: it contains no URLs and no Traefik labels. All routing is
configured in the Dokploy UI, and Dokploy injects the Traefik labels onto the
container at deploy time.

> **The #1 gotcha:** after you add or change a domain in Dokploy, you **must redeploy**
> for the routing labels to be applied to the container. Adding the domain alone does
> nothing until the next deploy.

---

## 1. Create the service

1. Push this repo to GitHub/GitLab (the `docker/` folder holds the build files).
2. In Dokploy: create a project → add a **Compose** service → point it at this repo.
3. Set the **Compose Path** to `docker/docker-compose.yml`.
   The build context is the repo root, set via `context: ..` inside the compose file,
   so the image can copy `src/`, `prisma/`, etc.

## 2. Environment variables

In the service's **Environment** settings, set:

| Variable                                          | Notes                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `AUTH_SECRET`                                      | Long random string. Generate below.                                |
| `SEED_USER1_EMAIL` / `_PASSWORD` / `_NAME`        | First user, seeded on boot (idempotent).                           |
| `SEED_USER2_EMAIL` / `_PASSWORD` / `_NAME`        | Second user.                                                       |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`DATABASE_URL` is **not** set here — it's fixed to the volume path (`file:/data/app.db`)
inside `docker/docker-compose.yml` on purpose.

> Use strong passwords for both seed users — these are real login credentials.

## 3. Persistent storage

The compose file declares a named volume `db-data` mounted at `/data`; the SQLite
database lives at `file:/data/app.db`. **Confirm the volume is preserved across
redeploys before entering real data** — this is the one thing that's easy to get
wrong and costly to lose. The database file is the single backup target (see the
README's "Data & backups" section).

## 4. Domain + HTTPS (the important part)

Routing is **not** in the compose file. You wire it up in Dokploy:

1. **DNS:** in Cloudflare, add an `A` record for your subdomain (e.g.
   `expenses.example.com`) → the Droplet's IP.
2. **Dokploy → this Compose service → Domains tab → Add Domain:**
   - **Host:** `expenses.example.com`
   - **Service:** `app` (must match the service name in `docker/docker-compose.yml`)
   - **Container Port:** `3000`
   - **HTTPS:** on, with **Let's Encrypt**
3. **Redeploy the service.** ← Do not skip this. Dokploy only injects the Traefik
   router labels onto the container during a deploy. Adding the domain without
   redeploying leaves the container with no route → Traefik returns `404`.

Auth.js runs with `trustHost`, so it honors the host/proto Traefik forwards — no
`AUTH_URL` is needed.

### Cloudflare SSL mode

In Cloudflare → **SSL/TLS → Overview**, use **Full** (or **Full (strict)** once the
cert is issued). **Never use "Flexible"** with Dokploy/Traefik — Flexible talks to the
origin over plain HTTP while Traefik serves HTTPS, which surfaces as a `400` or a
redirect loop.

### Let's Encrypt + Cloudflare proxy (chicken-and-egg)

If the `expenses` record is **proxied** (orange cloud), Traefik's HTTP-01 challenge can
fail and the cert never issues. If that happens, temporarily set the record to
**DNS only (grey cloud)**, redeploy/wait for the cert to issue, then re-enable the
proxy.

## 5. Multiple apps on the same Droplet

This service does **not** publish a host port (it uses `expose`, not `ports`). "Port
3000" exists only inside the container; Traefik routes by **hostname**, not port. So
running several apps that each listen on 3000 internally is fine — they never collide.
The only thing that must be unique per app is the **domain**.

## 6. Redeploys

Each redeploy re-runs migrations (`prisma migrate deploy`) and the idempotent seed
automatically (see `docker/docker-entrypoint.sh`); the `db-data` volume keeps your data.

---

## Troubleshooting routing

When the site won't load, first find **which layer** is responding. The fastest way is
to hit the origin directly, bypassing Cloudflare:

```bash
# Replace <DROPLET_IP>. -k skips cert validation; --resolve forces the host→IP mapping.
curl -skI https://expenses.example.com \
  --resolve expenses.example.com:443:<DROPLET_IP>
```

| Symptom                                                              | Meaning                                                                    | Fix                                                                                 |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `404`, `text/plain`, ~19-byte body (`404 page not found`)            | Reached Traefik, but **no router matches the host**. Routing not wired.    | Add the domain in Dokploy (step 4) **and redeploy**.                                |
| `400` via Cloudflare but origin works with `--resolve`              | Cloudflare config (usually SSL mode).                                      | Set Cloudflare SSL to **Full**; check proxy/cert (step 4).                          |
| Cert warnings / handshake errors                                    | Let's Encrypt cert not issued yet.                                         | Set the record to DNS-only until the cert issues, then re-proxy.                    |
| Nothing in the **app** container logs                               | Request is rejected at Traefik/Cloudflare, before reaching Next.js.        | Look at the **Traefik** container logs, not the app's.                              |

### Confirming routing is actually wired

```bash
# 1. Is the container on Dokploy's proxy network?
docker network inspect dokploy-network \
  --format '{{range .Containers}}{{println .Name}}{{end}}'
#    → your "...-app" container should be listed.

# 2. Did Dokploy inject Traefik labels onto the container?
docker inspect <app_container> --format '{{json .Config.Labels}}'
#    → after a domain is added AND redeployed, you should see traefik.* labels here.
#      If you only see com.docker.compose.* labels, the domain isn't wired/deployed.

# 3. Does Traefik have a router for the host?
curl -s http://localhost:8080/api/http/routers | grep -i 'expenses\|example'
#    → empty means no route exists yet.
```

> Verified end-to-end: image builds, first boot migrates + seeds, login works, and the
> database persists across a full container recreation on the same volume.
