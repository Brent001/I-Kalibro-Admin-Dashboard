# 📚 i/Kalibro Admin Portal

A modern, full-featured **Smart Library Management System** built with [SvelteKit](https://kit.svelte.dev/) and [Tailwind CSS](https://tailwindcss.com/).  
Designed for **Metro Dagupan Colleges** to streamline library operations, manage members, and gain actionable insights.

---

## ✨ Features

- 🏛️ **Dashboard**  
  Get a quick overview of library statistics, recent activity, and overdue books.

- 📖 **Book Management**  
  Add, edit, search, and organize your entire collection with ease.

- 🧑‍🎓 **Member Management**  
  Manage students, faculty, and staff accounts, including status and borrowing activity.

- 📊 **Analytics & Reports**  
  Visualize trends and generate reports to optimize library operations.

- 🔒 **Secure Authentication**  
  JWT-based login with role-based access control.

- 🌙 **Modern UI**  
  Responsive, accessible, and dark-mode ready interface.

---

## 🛠️ Tech Stack

- [SvelteKit](https://kit.svelte.dev/) &nbsp; ![Svelte](https://img.shields.io/badge/-Svelte-orange?logo=svelte)
- [Tailwind CSS](https://tailwindcss.com/) &nbsp; ![Tailwind](https://img.shields.io/badge/-Tailwind%20CSS-38B2AC?logo=tailwindcss&logoColor=white)
- [Drizzle ORM](https://orm.drizzle.team/) &nbsp; ![Drizzle](https://img.shields.io/badge/-Drizzle%20ORM-4B5563)
- [JWT Auth](https://jwt.io/) &nbsp; ![JWT](https://img.shields.io/badge/-JWT-000?logo=jsonwebtokens)
- [TypeScript](https://www.typescriptlang.org/) &nbsp; ![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white)

---

## 📂 Project Structure

```
src/
  lib/           # Reusable UI components
  routes/        # SvelteKit routes (pages & API)
  server/        # Database & server logic
  app.css        # Global styles (Tailwind + custom)
```

## Deployment

Set `DATABASE_URL` in the deployment provider's server/build environment before deploying. Keep it as a server-side secret; do not expose it to browser code or commit it to the repository.

Metadata lookup cover storage reuses the existing `VITE_BACKBLAZE_KEY_ID`, `VITE_BACKBLAZE_APPLICATION_KEY`, `VITE_BACKBLAZE_BUCKET_NAME`, and `VITE_BACKBLAZE_REGION` variables. Covers are served through the existing `/api/images/cover/...` proxy. `GOOGLE_BOOKS_API_KEY` is optional and only provides a steadier Google Books quota; lookup works without it. A Crossref contact email is optional and is not required by this integration.

Netlify runs the database preparation step before the build. For Vercel or AWS, use the equivalent build command:

```bash
npm run db:prepare && npm run build
```

The preparation step creates missing tables in a fresh database and is a no-op when the schema is current. Review production schema changes and use an appropriate migration process before deploying changes to an existing production database.

---

## 📝 License

This project is **unlicensed**.

---

## ⚠️ Disclaimer

> **This repository is for educational and reference purposes only.**
>
> **It is strictly prohibited to use, copy, modify, distribute, or deploy any part of this codebase for any purpose other than reading and review.**
>
> **Any unauthorized use of this code is illegal and may result in legal action.**

---

## 👥 Group 1 Members

- Brent Kenneth
- Angelica
- Art Kendrick
- Kristel
- Joseph Benjamin
- Jennylyn

**Software Engineering 1, College of Computer Studies**

---

## 🙏 Acknowledgements

- [Svelte](https://svelte.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Lucide Icons](https://lucide.dev/)
- [Metro Dagupan Colleges](https://mdc.edu.ph/)

---

> Made with ❤️ by the MDC Library IT Team  
> **Group 1 Software Engineering 1, College of Computer Studies**
