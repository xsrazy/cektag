# CekTag

**Live: https://cektag.xsrazy.web.id**

CekTag is a web service that looks up the GetContact tags of a phone number: the list of names or nicknames other people saved that number under in their contacts. It is used to identify unknown callers and spot spam. Each check costs Rp 2,000, paid via QRIS, with no registration and no subscription.

## Site Contents

- **Homepage:** a check form (08xx numbers are formatted automatically), an explanation of how it works, and an FAQ section.
- **Check flow:** the user enters a number, pays Rp 2,000 via QRIS, and the system fetches the latest tags from GetContact in real time (under 10 seconds) and displays the list.
- **Privacy page:** explains the data policy. Every check goes straight to GetContact in real time and results are not stored; in the logs, phone numbers and IP addresses are only recorded as hashes that cannot be read back.
- **Admin panel:** a protected login to monitor transactions and GetContact quota usage.

As the site itself states, tag accuracy depends on GetContact's crowdsourced data, so results are an indication, not a certainty.

## Frontend

- Next.js 14 (App Router) with React and TypeScript.
- Public pages: home with the check form, the result view, and the privacy page.
- Forms are protected with Cloudflare Turnstile.

## Backend

- Next.js API routes create payment invoices, receive payment webhooks, and call the GetContact API when a check runs.
- QRIS payments use the SayaBayar gateway: one invoice per check, with paid status confirmed through its webhook.
- Quota and payment sessions are stored in Upstash Redis, with an in-memory storage fallback.
- The admin password is stored as a bcrypt hash.
- The local `.secrets.json` credentials file is never committed; it is listed in `.gitignore`.
