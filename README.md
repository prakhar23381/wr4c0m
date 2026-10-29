# wr4c0m

Web app for a UK utility's day-ahead trading team: shows the latest national wind generation forecast available at the day-ahead gate closure, and quantifies how accurate those forecasts have been (Elexon BMRS `FUELHH` actuals vs `WINDFOR` forecasts, January 2026).

**Live app:** https://wr4c0m.vercel.app · **API docs:** https://wr4c0m.vercel.app/api/docs

> 🚧 Work in progress. The full README (live app link, repository layout, how to run, methodology) will be completed before submission.

## Stack

- **Frontend:** React + TypeScript (Vite)
- **Backend:** Python 3.12, FastAPI
- **Deployment:** Vercel (static frontend + Python serverless function); Docker for local development

## Use of AI tools

This project was built with the help of AI tools (Claude Code), which were used for planning, scaffolding, and code generation. All code was reviewed and tested.
