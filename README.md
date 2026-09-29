# Vend Shop Tracker

A small PWA for tracking your Growtopia vend shop: item name, modal (cost), sell price, stock and profit. Built with Vite, React and TypeScript. Works offline once installed.

## Features

- Add, view, edit and delete items (full CRUD)
- Modal and sell price in WL each, or as bulk (e.g. `200 / 1 WL` = 200 items for 1 WL)
- All values are rounded to whole WL; amounts of 100 WL or more also show as DL
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
