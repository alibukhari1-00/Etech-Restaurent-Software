# Restaurant Discovery Backend for Vercel

This project provides a simple Vercel backend for your existing `index.html` form.

## What it does
- accepts survey submissions from the frontend
- generates a CSV attachment from submitted fields
- sends the submission to your Gmail address

## Files
- `public/index.html` — updated form and client-side submission logic
- `api/submit.js` — Vercel serverless function that accepts POST data and sends email
- `package.json` — includes `nodemailer` dependency

## Setup
1. Add the files to your Git repository.
2. Deploy to Vercel.

## Deployment
Push to GitHub and connect the repository to Vercel. Vercel will serve `public/index.html` and the backend at `/api/submit`.

## Vercel configuration
A `vercel.json` file is included so Vercel routes static pages from `public/` and functions from `api/`.

## CSV storage
Submissions are now saved to a backend CSV file at runtime.

## Validation
The frontend enforces required fields and checkbox groups, with inline field-level error messages for missing inputs. The backend also validates that every required field is present and that at least one order channel, one delivery source, and one payment method are selected.

> Note: Vercel serverless functions use an ephemeral filesystem, so `/tmp` storage is not persistent across all invocations or deployments. For stable storage you should use a database or cloud storage service.

## Troubleshooting
- If the form shows a terms-of-service error, the live deployment may still be serving an old page (for example the previous Formspree form action). Redeploy from this repository and confirm the live site uses the updated `public/index.html`.
- If the form does not submit, confirm the form action is `/api/submit` and the API route exists in the deployed project.
