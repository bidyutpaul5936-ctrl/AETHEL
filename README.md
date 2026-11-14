# AETHEL

A two-page responsive portfolio site and admin preview built with plain HTML, CSS, and JavaScript.

## Run locally

Install Node.js, then run `npm run dev` from this folder. Open http://localhost:5173/ for the client page and http://localhost:5173/admin.html for the admin preview. Set the `PORT` environment variable to use a different port.

The site uses a small Node.js static server and has no package dependencies. The project request form, client accounts, order status, project board, and checklist use browser local storage. Requests are not sent to an email service or database.

Client project requests appear in the admin Orders panel and can be moved through Received, In review, In progress, Complete, and Declined. Clients can create an account at the bottom of the home page to see their own request statuses.

This account flow is a browser-only preview: accounts and orders stay in that browser profile and are not shared across devices. Add a real backend and server-side authentication before using it for live client data.
