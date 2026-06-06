# Italian Verb Explorer

A clean, shareable GitHub Pages website for studying Italian verbs from your Google Sheet.

## What this version includes

- Cleaner premium front end
- Stable layout that does not collapse into default blue links
- Search by verb, meaning, Italian sentence, or English translation
- Four main tabs:
  - Presente
  - Futuro semplice
  - Futuro anteriore
  - Congiuntivo
- Smooth scrolling from each tab to its section
- Extra section for forms in your current sheet that are not one of the four requested tabs, such as Condizionale semplice
- Copy-all button for a selected verb
- Mobile-friendly design

## Important note about Futuro anteriore

Your current spreadsheet data has Condizionale semplice, not Futuro anteriore. The Futuro anteriore tab is visible and ready, but it will show an empty-state message until your sheet includes Futuro anteriore rows.

If you later replace the third block in your sheet with Futuro anteriore, add these GitHub Actions variables:

```text
THIRD_BLOCK_MOOD = Indicativo
THIRD_BLOCK_TENSE = Futuro anteriore
```

Then rerun the GitHub Action.

## Updating GitHub

Replace these files in your repository:

```text
site/index.html
site/styles.css
site/app.js
scripts/build_data.py
README.md
```

Then commit the changes and rerun the GitHub Action.
