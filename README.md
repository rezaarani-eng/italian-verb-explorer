# Italian Verb Conjugation Explorer

A free, static website for searching your Italian verb spreadsheet.

Type a verb such as `abbracciare`, and the site shows 24 cards:

- 6 people in **Presente**
- 6 people in **Futuro semplice**
- 6 people in **Condizionale semplice**
- 6 people in **Congiuntivo presente**

Each card shows the extracted conjugated form, the full Italian sentence, and the English translation.

## Folder structure

```text
site/
  index.html
  styles.css
  app.js
  data/verbs.json
scripts/
  build_data.py
.github/workflows/
  deploy.yml
```

## Fastest way to try it locally

Open `site/index.html` in your browser.

Some browsers block local JSON loading from `file://`. If that happens, run this from the project folder:

```bash
python -m http.server 8000 -d site
```

Then open:

```text
http://localhost:8000
```

## Connect it to your Google Sheet

GitHub Pages is static hosting, so Python is used in the GitHub Actions build step, not on each visitor request. The browser loads `verbs.json` and searches it instantly.

1. Upload your workbook to Google Sheets.
2. Keep the clean verb table in one tab using the same layout:
   - Column A has the numbered verb, such as `34 - abbracciare`.
   - Columns B:G contain 6 forms for one group.
   - Columns H:M contain 6 forms for the next group.
   - Each verb uses 4 rows: Italian examples, English translations, Italian examples, English translations.
3. In Google Sheets, choose **File → Share → Publish to web**.
4. Select the verb table tab, choose **Comma-separated values (.csv)**, and publish.
5. Copy the published CSV URL.

## Add the CSV URL to GitHub

In your GitHub repository:

1. Go to **Settings → Secrets and variables → Actions**.
2. Add either:
   - a repository secret named `SHEET_CSV_URL`, or
   - a repository variable named `SHEET_CSV_URL`.
3. Paste your published CSV URL as the value.

## Deploy on GitHub Pages

1. Push this project to a GitHub repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions**.
4. Go to the **Actions** tab.
5. Run **Build and deploy Italian verb site** manually once.

After that, the workflow updates the site daily and whenever you push to `main`.

## Customize the design

The visual design is controlled almost entirely by:

```text
site/styles.css
```

Good things to customize:

- color variables at the top of the CSS file
- hero title/subtitle in `site/index.html`
- suggested search chips in `site/app.js`

## Important privacy note

Publishing a Google Sheet to the web makes that published content publicly accessible. Do not include private notes, emails, phone numbers, or anything you would not want online.
