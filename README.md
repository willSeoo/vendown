# Vend Shop Tracker

A small PWA for tracking your Growtopia vend shop: item name, modal (cost), sell price, stock and profit. Built with Vite, React and TypeScript. Works offline once installed.

## Features

- Add, view, edit and delete items (full CRUD)
- Modal and sell price in WL each, or as bulk (e.g. `200 / 1 WL` = 200 items for 1 WL)
- All values are rounded to whole WL; amounts of 100 WL or more also show as DL
- Categories (Block, Background, Consumable, Surgery, Clothing, Seed, Item, Other): pick one per item, filter and sort by category; PDFs and CSVs are split into a section per category with subtotals
- Discord promo templates: make several templates (e.g. one per Discord server/category) with header, footer, word before each item ("Sell"), separator (" | ") and price mode; copy the ready message. Messages over 2000 characters are split automatically
- Market tab: keep dated price notes per item (e.g. Climbing Vine 11/1 WL as of 11 Aug 2026) with full history and change vs the previous note. The newest note also updates the market price of the matching inventory item, and a market price typed in the item form is logged too
- Images tab: upload many pictures at once, matched to items by file name ("Climbing Vine.png" = item "Climbing Vine"); images show in Items and Market and can also be added by tapping the picture box. Stored in IndexedDB, shrunk to max 160 px
- Built-in item pictures: put images in `public/items/` named after the item (e.g. `Climbing Vine.webp`) and add the file name to `public/items/index.json`; they show up automatically (59 included). Uploaded images override built-in ones. Pictures are display only (not clickable); upload them from the Images tab
- Name suggestions: typing an item name (stock or market form) shows matching names with their pictures; picking one also fills the category and latest market price when known
- PDFs show the item picture next to the item name
- Mobile first: bottom tab bar with big touch targets, item cards with a large Sold button, forms that open with a "+ Add" button, 16px inputs (no zoom on iPhone), safe-area aware; on desktop the tabs move to the top
- Item cards are collapsed by default (picture, name, category); tap the name to open modal, sell, market, profit, stock and the Sold / Edit / Delete buttons. "Expand all" / "Collapse all" toggles the whole list
- Desktop layout: sticky top bar with tabs, item and market cards in 2 to 3 columns, 3-column forms
- Optional market price per item (WL each or bulk), saved with the date you set it, and compared to your sell price (% above / below market). The market price at the time of each sale is stored in the sales report
- Profit for all stock, margin, and totals (stock, money tied up, profit if all sold)
- "Sold" button with a quantity box that reduces stock
- Search and sort (newest, name, highest profit, highest sell price)
- Sales report: every "Sold" is logged; view totals by period (today, 7 days, 30 days, all time), a by-item breakdown, and a day-by-day transaction list with Undo (restores stock)
- Download PDF (`items-vend-20-oct-2026.pdf`, `sales-vend-20-oct-2026.pdf`) or CSV files (opens in Excel / Google Sheets): `items-vend-20-oct-2026.csv` (full item list) and `sales-vend-20-oct-2026.csv` (sales report for the selected period), dated with today's date
- Installable and works offline (PWA)
- Data is saved in the browser (`localStorage`), per device

## Requirements

- Node.js 18 or newer

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Build and test the PWA

The service worker only runs in a production build.

```bash
npm run build
npm run preview
```

## Deploy

The build output is a static site in `dist/`. Any static host with HTTPS works.

| Host | Settings |
| --- | --- |
| Vercel | Framework: Vite. Build command `npm run build`, output `dist` |
| Netlify | Build command `npm run build`, publish directory `dist` |
| Cloudflare Pages | Build command `npm run build`, output directory `dist` |

## Install on your phone

- Android (Chrome): menu, then "Install app"
- iPhone (Safari): Share, then "Add to Home Screen"

## Project structure

```
index.html
vite.config.ts        Vite + PWA manifest and caching
public/               App icons (192, 512, apple-touch-icon)
public/items/         Built-in item pictures + index.json (list of file names)
src/main.tsx          Entry point
src/App.tsx           All logic and UI
src/index.css         Styles (light and dark theme)
```

## Customize

- **Icons:** replace the PNGs in `public/` with your own, keeping the same names and sizes.
- **Colors:** edit the CSS variables at the top of `src/index.css`.
- **App name and theme color:** edit the `manifest` block in `vite.config.ts`.
- **Storage key:** items are stored under `vend-items-v1` in `localStorage` (see `KEY` in `src/App.tsx`). Sales are stored under `vend-sales-v1`.

## Notes

- Data lives only in the browser it was entered in. Clearing site data erases it, and phone and PC do not sync.
- To sync across devices you would need a backend or database (for example Supabase or Firebase).
