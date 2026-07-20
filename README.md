# AgriSpecimen Registry

A responsive agricultural specimen database built with **Next.js**, **Appwrite**, **GitHub**, and **Vercel**.

## Included features

- Normal email/password accounts; no admin/user role split.
- Every specimen permanently records the contributor's Appwrite user ID, name, and email.
- Global search across every specimen field plus a specific-field filter.
- Full collection, location, ecology, host, taxonomy, status, and reference fields.
- Optional front, side, dorsal, ventral, label, habitat, and other photographs.
- Orderly specimen detail view opened from the specimen card.
- Contributor-only record editing, status toggles, and deletion.
- Related-family records and a cautious possible-predator suggestion area.
- Downloadable JPEG record sheet, multi-page PDF record, and original photos.
- Agricultural visual design, iOS-inspired liquid glass, responsive layout, and fade-in/fade-out scroll animation.

> The uploaded `labtrack-logs-current-page.xls` was inspected. It is an HTML-formatted one-row inventory activity log, not a specimen-data template, so it is not imported into this registry.

---

# Complete beginner setup

## Part 1 — Install the programs

Install these first:

1. **Node.js LTS** from the official Node.js website.
2. **Visual Studio Code**.
3. **Git** from the official Git website.
4. Create free accounts at **GitHub**, **Appwrite Cloud**, and **Vercel**.

After installing Node.js, open **Command Prompt** and run:

```bash
node -v
npm -v
git --version
```

You should see version numbers.

## Part 2 — Open this project

1. Extract the downloaded ZIP.
2. Open Visual Studio Code.
3. Click **File > Open Folder**.
4. Choose the extracted `agri-specimen-registry` folder.
5. In VS Code, click **Terminal > New Terminal**.
6. Run:

```bash
npm install
```

## Part 3 — Create the Appwrite project

1. Sign in to Appwrite Cloud.
2. Click **Create project**.
3. Name it `AgriSpecimen Registry`.
4. Open the project.
5. On the project overview, copy:
   - **Project ID**
   - **API endpoint**, which looks similar to `https://sgp.cloud.appwrite.io/v1`

## Part 4 — Add the local web platform

Appwrite needs permission to accept requests from your website.

1. In Appwrite, open your project.
2. Go to **Overview** or **Integrations / Platforms**.
3. Click **Add platform**.
4. Choose **Web app**.
5. Name: `Local Development`.
6. Hostname: `localhost`.
7. Save.

Do not type `http://localhost:3000`; type only `localhost` in the hostname box.

## Part 5 — Create your `.env.local` file

1. In VS Code, find `.env.example`.
2. Right-click it and copy it.
3. Rename the copy to `.env.local`.
4. Replace the first two placeholder values:

```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://YOUR-REGION.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=YOUR_PROJECT_ID
NEXT_PUBLIC_APPWRITE_DATABASE_ID=agri-registry
NEXT_PUBLIC_APPWRITE_TABLE_ID=specimens
NEXT_PUBLIC_APPWRITE_BUCKET_ID=specimen-photos
APPWRITE_API_KEY=PASTE_YOUR_TEMPORARY_API_KEY_HERE
```

Keep the three IDs exactly as written unless you deliberately want different IDs.

## Part 6 — Create a temporary Appwrite API key

This key is used only once to build the database automatically.

1. In Appwrite, open **Project settings**.
2. Open **API keys**.
3. Click **Create API key**.
4. Name it `Temporary setup key`.
5. For the easiest beginner setup, temporarily select the database/TablesDB and Storage read/write scopes. If the console offers an all-scopes option, you may use it only for this temporary key.
6. Create the key.
7. Copy the secret immediately.
8. Paste it after `APPWRITE_API_KEY=` in `.env.local`.

Never upload `.env.local` to GitHub. It is already ignored by `.gitignore`.

## Part 7 — Automatically create the Appwrite database

In the VS Code terminal, run:

```bash
npm run setup:appwrite
```

The script creates:

- Database: `agri-registry`
- Table: `specimens`
- Search and filter indexes
- Storage bucket: `specimen-photos`
- Signed-in-user read/create permissions
- Per-record and per-file contributor update/delete permissions

After the terminal says setup is complete:

1. Return to Appwrite.
2. Delete the `Temporary setup key`.
3. In `.env.local`, you may remove the entire `APPWRITE_API_KEY=...` line.

## Part 8 — Run the website locally

In the terminal, run:

```bash
npm run dev
```

Open this in your browser:

```text
http://localhost:3000
```

Create an account, sign in, and add a test specimen.

To stop the website, click the terminal and press:

```text
Ctrl + C
```

## Part 9 — Create the GitHub repository

1. Sign in to GitHub.
2. Click the **+** icon in the top-right.
3. Click **New repository**.
4. Repository name: `agri-specimen-registry`.
5. Choose **Private** while testing, or **Public** if you want the source code visible.
6. Do not add a README, `.gitignore`, or license because this project already contains them.
7. Click **Create repository**.

GitHub will show commands. In the VS Code terminal, run these, replacing `YOUR-USERNAME`:

```bash
git init
git add .
git commit -m "Initial AgriSpecimen registry"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/agri-specimen-registry.git
git push -u origin main
```

If Git asks for your identity first, run:

```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

Then repeat the commit and push commands.

## Part 10 — Deploy to Vercel

1. Sign in to Vercel using GitHub.
2. Click **Add New > Project**.
3. Find `agri-specimen-registry`.
4. Click **Import**.
5. Vercel should automatically detect **Next.js**.
6. Before deploying, open **Environment Variables**.
7. Add these five variables exactly:

```text
NEXT_PUBLIC_APPWRITE_ENDPOINT
NEXT_PUBLIC_APPWRITE_PROJECT_ID
NEXT_PUBLIC_APPWRITE_DATABASE_ID
NEXT_PUBLIC_APPWRITE_TABLE_ID
NEXT_PUBLIC_APPWRITE_BUCKET_ID
```

Use the same values from `.env.local`. Do **not** add `APPWRITE_API_KEY` to Vercel.

8. Click **Deploy**.
9. After the build finishes, Vercel gives you a URL such as:

```text
https://agri-specimen-registry.vercel.app
```

## Part 11 — Allow the Vercel domain in Appwrite

Without this step, login may work locally but fail on Vercel.

1. Copy your Vercel website URL.
2. Return to Appwrite.
3. Go to **Platforms / Integrations**.
4. Add another **Web app**.
5. Name it `Vercel Production`.
6. In hostname, enter only the domain, for example:

```text
agri-specimen-registry.vercel.app
```

Do not include `https://` and do not include a slash.

Save it, then refresh the Vercel website.

## Part 12 — Update the site later

Edit the code in VS Code, then run:

```bash
git add .
git commit -m "Describe what you changed"
git push
```

Vercel automatically creates a new deployment after every push to GitHub.

---

# Important Appwrite permissions

The automatic setup uses this policy:

- Every signed-in user can create and view specimen records.
- Only the original contributor can update or delete their record.
- Every uploaded photo can be viewed by signed-in users.
- Only the uploader can update or delete their uploaded photo.
- Contributor identity is copied into the specimen row for accountability.

This is safer than letting every account overwrite every other account's scientific records.

# How search works

The form stores all detailed fields inside `dataJson` and also creates a normalized `searchText` value containing every field label and value. This lets one search box match specimen number, date, verification, locality, taxonomy, ecology, collector, status, and references. Core columns such as family, genus, species, status, and contributor also have indexes for future expansion.

# Notes about predator suggestions

The website does not invent predator relationships. The `Possible predator` field is optional, and the details page warns users that relationships must be supported by observation, literature, or expert verification.

# Troubleshooting

### `npm` is not recognized
Restart the computer after installing Node.js, then reopen VS Code.

### PowerShell says scripts are disabled
Open **Command Prompt** instead of PowerShell, navigate to the project folder, and run the same npm commands there.

### Appwrite says `Invalid origin`
Add both `localhost` and your exact Vercel hostname as Web platforms in Appwrite.

### Appwrite says a table, column, or bucket already exists
That is safe. The setup script is designed to skip resources that already exist.

### Vercel environment variable is undefined
Add the variable in **Vercel Project > Settings > Environment Variables**, then redeploy the project.

### A specimen cannot be edited
Only the account that created that specimen can edit it. Sign in using the original contributor account.

### PDF/JPEG export misses a photo
Confirm the Appwrite Vercel platform is added, refresh the page, and try again. Cross-origin image access depends on the Appwrite project accepting your website domain.
