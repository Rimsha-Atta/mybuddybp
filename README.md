# Hypertension Buddy 🩺

**Hypertension Buddy** is a comprehensive, professional-grade blood pressure tracking and management application. It empowers users to monitor their cardiovascular health with ease, providing layered guideline-based classifications, trend analysis, and personalized health guidance.

![Dashboard Showcase](./screenshots/dashboard.png)

## 🏗️ Project Architecture

The application is built using a modern **Full-Stack** architecture, ensuring speed, security, and scalability.

- **Frontend (Next.js 15):** A high-performance React framework utilizing the **App Router** for efficient navigation and server-side optimization. It handles the UI, state management, and client-side logic for BP classification and PDF report generation.
- **Styling (Tailwind CSS):** Provides a fully responsive, utility-first design with a focus on premium aesthetics, including a "Card-based" UI and smooth interactivity.
- **Backend (Supabase):**
  - **Auth:** Secure user authentication (Email/Password).
  - **Database:** A robust PostgreSQL database for storing user profiles and health readings.
  - **RLS (Row Level Security):** Ensures that each user can only access and modify their own medical data.
- **Icons & Visuals:** Powered by **Lucide React** for professional iconography and **Recharts** for interactive health trend visualizations.

### Folder Structure

```text
├── app/                  # Next.js App Router (Pages, Layout, Styles)
├── lib/                  # Shared utilities (Supabase Client)
├── public/               # Static assets (Images, Icons)
├── supabase/             # Database schemas and SQL migration files
├── README.md             # Project documentation
└── package.json          # Dependencies and scripts
```

## 📊 Database Schema

The core of the data layer is the `readings` table in Supabase, structured as follows:

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique identifier for each reading |
| `user_id` | UUID (FK) | Reference to the authenticated user (`auth.users`) |
| `systolic` | Integer | Systolic pressure measurement (mmHg) |
| `diastolic` | Integer | Diastolic pressure measurement (mmHg) |
| `age` | Integer | User age (Years) |
| `metadata` | JSONB | Guideline metadata (AHA category, age-layer flags, emergency and regional notes, ICD-11 code) |
| `created_at` | Timestamptz | Timestamp of when the measurement was recorded |

## 🖥️ UI Showcase

### Dashboard
The main command center for health tracking.
![Dashboard Screenshot](./screenshots/dashboard.png)

### Profile Management
Professional card-based layout for personal and account details.
![Profile Screenshot](./screenshots/profile.png)

### Reading History
Detailed history log with instant classification badges.
![History Screenshot](./screenshots/history.png)

## 🧠 Key Features & Logic

### Multi-Layered Clinical Decision Logic
The application uses a layered rule engine that combines global and regional standards:

| Category (AHA 2017 core) | Systolic (mmHg) | | Diastolic (mmHg) |
| :--- | :--- | :--- | :--- |
| **Normal** | < 120 | AND | < 80 |
| **Elevated** | 120 – 129 | AND | < 80 |
| **Stage 1** | 130 – 139 | OR | 80 – 89 |
| **Stage 2** | ≥ 140 | OR | ≥ 90 |
| **Crisis** | ≥ 180 | OR | ≥ 120 |

Additional layers applied on top of AHA core logic:
- **JNC-8 / ACP Age Context:** For users aged 60+, systolic `<150` with diastolic `<90` is shown with age-adjusted normal context while retaining AHA category metadata.
- **Emergency Trigger (ACC/AHA ACS 2021 + ESC NSTEMI 2023):** `Systolic > 180` or `Diastolic > 120` raises a **Critical Alert** requiring immediate evaluation.
- **ESC 2023 Context:** Readings above `140/90` append: *"Meets ESC 2023 Hypertension criteria for pharmacological consideration"*.
- **WHO ICD-11 Coding:** Every displayed result appends: *"WHO ICD-11 Code: BA00 (Essential Hypertension)"*.

### Core Functionality
- **Instant Classification:** Real-time feedback and clinical advice for every reading.
- **Trend Visualizations:** Interactive charts showing systolic and diastolic progress over time.
- **PDF Reports:** Generate and download professional medical reports for sharing with physicians.
- **WHO Lifestyle Guidance:** Sodium under 5g/day, 150 min/week moderate aerobic activity, DASH nutrition, and stress management.
- **Responsive Design:** A premium experience across mobile, tablet, and desktop.
- **Dark Mode:** Full support for system-wide dark and light themes.

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Database/Auth:** [Supabase](https://supabase.com/)
- **Charts:** [Recharts](https://recharts.org/)
- **PDF:** [jsPDF](https://github.com/parallax/jsPDF)
- **Icons:** [Lucide React](https://lucide.dev/)

## 🚀 Future Roadmap

- [ ] **Bilingual Support:** Multi-language interface starting with Arabic and English.
- [ ] **PWA (Progressive Web App):** Installable on mobile devices for offline access and native-like performance.
- [ ] **Medication Reminders:** Automated notifications for daily medication adherence.
- [ ] **AI Insights:** Predictive analysis of health trends using machine learning.

---
Developed with care for a healthier heart. ❤️
