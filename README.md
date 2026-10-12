# Brave Voices

A child-friendly public-speaking question checklist. Questions are loaded from `question.txt`, completed prompts are saved in the browser with `localStorage`, and the app shell is cached for offline use after the first visit.

## Run locally

Open PowerShell in this folder and start a static server:

```powershell
cd C:\Users\KurrinchiBalakrishna\Downloads\stkopt-main\question
python -m http.server 8767
```

Open <http://localhost:8767>. Press `Ctrl+C` in PowerShell to stop the server.

Do not open `index.html` by double-clicking it. Browsers commonly block `question.txt` when the page uses a `file://` address.

## How progress is saved

Checkbox progress is stored only in the current browser and domain. Progress on `localhost` is separate from progress on the deployed `onrender.com` site. Clearing site data or using a different browser/device starts a new checklist.

## Add or edit questions

Edit `question.txt`, commit it to GitHub, and refresh the deployed page after Render finishes its automatic deployment. The site requests the newest question file and rebuilds the list on every visit.

The browser automatically:

- removes duplicate questions, ignoring capitalization, punctuation, accents, and extra spacing;
- repairs common copied-text encoding artifacts;
- preserves the first category in which a duplicate appears;
- keeps completed-question IDs in browser storage even if questions are reordered, moved to another category, temporarily removed, or later re-added.

For new categories, use a Markdown heading followed by numbered or unnumbered questions:

```text
## My New Category
1. What makes a speaker interesting to listen to?
2. How would you introduce yourself to a new class?
```

You can append as many categories and questions as needed. Exact duplicates do not appear twice in the website, so manually cleaning the source file is optional.

## Publish to GitHub

Create an empty GitHub repository, then run these commands in this folder:

```powershell
git init
git add .
git commit -m "Create Brave Voices question checklist"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace `YOUR-USERNAME` and `YOUR-REPOSITORY` with your GitHub details.

## Deploy on Render

This repository includes `render.yaml` for a Render static site.

1. Sign in to Render and choose **New > Blueprint**.
2. Connect the GitHub repository.
3. Select the repository containing this project.
4. Apply the Blueprint.

Alternatively, create a **Static Site** manually with:

- Build command: leave empty
- Publish directory: `.`

Render will provide an `onrender.com` address and redeploy when changes are pushed to the connected branch.
