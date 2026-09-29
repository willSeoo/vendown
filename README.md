# Vend Shop Tracker

A small PWA for tracking your Growtopia vend shop: item name, modal (cost), sell price, stock and profit. Built with Vite, React and TypeScript. Works offline once installed.

## Features

- Add, view, edit and delete items (full CRUD)
- Modal and sell price in WL each, or as bulk (e.g. `200 / 1 WL` = 200 items for 1 WL)
- All values are rounded to whole WL; amounts of 100 WL or more also show as DL
- Profit for all stock, margin, and totals (stock, money tied up, profit if all sold)
- "Sold" button with a quantity box that reduces stock
- Search and sort (newest, name, highest profit, highest sell price)
- Installable and works offline (PWA)
- Data is saved in the browser (`localStorage`), per device


## Notes

- Data lives only in the browser it was entered in. Clearing site data erases it, and phone and PC do not sync.
- To sync across devices you would need a backend or database (for example Supabase or Firebase).
