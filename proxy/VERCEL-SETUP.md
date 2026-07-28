# Vercel setup — click by click

For setting up the PAUSE proxy through web dashboards only. No terminal.

Nothing here is dangerous to get wrong on the first try. If a step fails, fix
the setting and press **Redeploy** — the app is untouched until the very last
part.

---

## Before you start

Two browser tabs open:

- **Vercel** — https://vercel.com
- **Postbase** — https://db.clinoble.com

You need one secret from Postbase (the service key). Everything else is written
out below.

---

## Part 1 — Create the project

1. Go to https://vercel.com and log in with GitHub.
2. Click **Add New…** (top right) → **Project**.
3. Find **jaideeprao22/Pause-App** in the list → click **Import**.
4. **Stop before clicking Deploy.** There are settings to change first. If it
   deploys automatically, that's fine — the settings below still apply, you'll
   just redeploy at the end.

---

## Part 2 — Root Directory

The proxy is in a sub-folder, so Vercel has to be told where to look.

5. On the import screen, find **Root Directory** → click **Edit**.
6. Choose the folder named **`proxy`**.
7. Confirm the box now reads `proxy` and not `./` or blank.

> If you already deployed: **Settings → Build and Deployment → Root Directory**,
> set to `proxy`, **Save**.

**Framework Preset**: leave as **Other**. Build/Output/Install commands: leave
blank. There is no build step.

---

## Part 3 — Environment Variables

8. Open the **Environment Variables** section (on the import screen, or later at
   **Settings → Environment Variables**).
9. Add these **five**, one at a time. Names must match **exactly** — capitals,
   underscores, no spaces.

| # | Name | Value | Where it comes from |
|---|------|-------|---------------------|
| 1 | `POSTBASE_SERVICE_KEY` | *(secret — see below)* | Postbase dashboard → your project → **Settings → API Keys** → the **service** / secret key (the one **not** labelled public or anon). Copy the whole string. |
| 2 | `POSTBASE_PROJECT_ID` | `04a46c89-2217-4449-ae7f-57a4c479b988` | Already known — type it in. |
| 3 | `POSTBASE_URL` | `https://db.clinoble.com` | Already known. No trailing slash. |
| 4 | `GOOGLE_CLIENT_ID` | `857927388938-3rn4ejm805kukp10cerh4f7oakseejgn.apps.googleusercontent.com` | Already known. Must be the **same** client ID configured in Postbase (`provider=google`) and in Google Cloud Console. |
| 5 | `ALLOWED_ORIGIN` | `https://pause.jaideeprao.com` | The PAUSE site address. Exactly this — `https://`, no `www.`, **no trailing slash**. |

10. For **each** variable, tick all three environment boxes:
    **Production**, **Preview**, **Development**.
11. Click **Save** after each one.

**Do not add `POSTBASE_PASSWORD_AUTH_ENABLED`.** Password sign-in is off for
this project; adding it would switch on a path that cannot work.

### About the service key

This key can read and write every row in the database. It belongs in exactly
one place — this box — and nowhere else. Never paste it into the app code, a
GitHub file, a PR comment, or a chat message. If it is ever exposed, rotate it
in Postbase and update it here.

---

## Part 4 — Production Branch ⚠️ the one that matters

The proxy code only exists on the pull-request branch. It is **not** on `main`
yet, and it must not be merged to `main` until Part 6 is done — merging early
would put an app on the live site that cannot reach any backend.

So point Vercel at the PR branch instead of `main`:

12. Go to **Settings → Git**.
13. Find **Production Branch**. It will say `main`.
14. Change it to exactly:

    ```
    claude/postbase-serverless-proxy-ixretu
    ```

15. Click **Save**.

> **Why not just merge first?** GitHub Pages rebuilds the live app from `main`
> the moment anything lands there. Right now the app's `PAUSE_API_BASE` setting
> is empty, so a merge would immediately publish a version that cannot sign
> anyone in. The order is: deploy the proxy → put its address into the app →
> *then* merge.

Later, once everything works and the PR is merged, come back and change
Production Branch back to `main`.

---

## Part 5 — Region

Nothing to do. The region (Mumbai, `bom1`) is already set in the project's
`vercel.json` file, so it applies automatically.

16. *(Optional check)* **Settings → Functions** → **Function Region**. If it
    shows Mumbai / `bom1`, it worked. If it shows Washington D.C. / `iad1`,
    set it to **Mumbai — bom1** there and **Save**. Either way the proxy works;
    Mumbai is just faster for users in India.

---

## Part 6 — Deploy and collect the address

17. Click **Deploy** (or **Deployments → ⋯ → Redeploy** if it already built).
18. Wait for the green **Ready**.
19. Copy the project's address from the top of the page. It looks like:

    ```
    https://pause-app-xxxx.vercel.app
    ```

    Take it from **Settings → Domains** if you want the stable one rather than
    a per-deployment URL. **No trailing slash.**

This address is public and safe to put in the app — it is not a secret. The
secret stays in Part 3.

### Quick check it's alive

20. Paste this into your browser, replacing the address with yours:

    ```
    https://YOUR-ADDRESS.vercel.app/api/data/study-code?code=TEST
    ```

    - `{"error":"Origin not allowed"}` → **correct.** CORS is doing its job;
      the browser isn't the PAUSE site.
    - A Vercel 404 page → Root Directory is wrong. Back to Part 2.
    - `500` → an environment variable is missing or misspelled. Check
      **Deployments → the latest one → Functions** logs for which.

---

## Part 7 — Put the address into the app

Through the GitHub website, no terminal.

21. Go to https://github.com/jaideeprao22/Pause-App
22. Click the branch dropdown (says `main`) → choose
    **`claude/postbase-serverless-proxy-ixretu`**.
    **Make sure you are on that branch, not `main`.**
23. Click the file **`api.js`**.
24. Click the **pencil icon** (Edit this file).
25. Near the top, find this line:

    ```
    const PAUSE_API_BASE = '';
    ```

26. Put your address between the quotes:

    ```
    const PAUSE_API_BASE = 'https://YOUR-ADDRESS.vercel.app';
    ```

    Keep the quotes and the semicolon. No trailing slash.
27. Scroll down → **Commit changes**.
28. Choose **Commit directly to the `claude/postbase-serverless-proxy-ixretu`
    branch** — *not* "Create a new branch".
29. Click **Commit changes**.

---

## Part 8 — Test before merging

The live site still runs the old version at this point. To test the new one,
open the **PR branch preview**, or merge only once you're satisfied.

Sign in with Google and check:

- Sign-in completes and your name/avatar appears.
- **Your existing history is there** — past assessments, scores, journal
  entries. This is the important one.

If sign-in shows *"Your account is not linked yet"*, **stop and tell me.** That
is the proxy refusing on purpose because the Google account did not resolve to
its migrated user. It is protecting the data, not losing it — nothing is
damaged, and it is fixable.

---

## Part 9 — Merge, then switch the branch back

Only after Part 8 looks right:

30. Merge the pull request on GitHub.
31. Back in Vercel: **Settings → Git → Production Branch** → change to `main`
    → **Save**.
32. **Deployments → ⋯ → Redeploy** so production builds from `main`.

---

## Summary card

| Setting | Value |
|---|---|
| Root Directory | `proxy` |
| Framework Preset | Other |
| Production Branch (for now) | `claude/postbase-serverless-proxy-ixretu` |
| Production Branch (after merge) | `main` |
| Region | already set by `vercel.json` (`bom1`) |
| `POSTBASE_SERVICE_KEY` | from Postbase → Settings → API Keys → service key |
| `POSTBASE_PROJECT_ID` | `04a46c89-2217-4449-ae7f-57a4c479b988` |
| `POSTBASE_URL` | `https://db.clinoble.com` |
| `GOOGLE_CLIENT_ID` | `857927388938-3rn4ejm805kukp10cerh4f7oakseejgn.apps.googleusercontent.com` |
| `ALLOWED_ORIGIN` | `https://pause.jaideeprao.com` |
| `POSTBASE_PASSWORD_AUTH_ENABLED` | **do not add** |
