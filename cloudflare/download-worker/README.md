# CineSeya download Worker

This Worker serves only objects from the private `cineseya-media` binding after validating a short-lived token created by the application. It supports `GET`, `HEAD`, and range requests for resumable downloads.

```powershell
Copy-Item wrangler.toml.example wrangler.toml
npx wrangler secret put DOWNLOAD_SIGNING_SECRET
npx wrangler deploy
```

Use exactly the same `DOWNLOAD_SIGNING_SECRET` in Render and the Worker. After deployment, bind the configured `DOWNLOAD_DOMAIN` (for example `dl.cineseya.lk`), verify invalid/expired tokens return `403`/`410`, and test `GET`, `HEAD`, and a byte range against an issued token before setting `DOWNLOAD_WORKER_ENABLED=true` in the application.

Do not add the assets bucket to this Worker. Do not store secrets in `wrangler.toml`.
