"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Profile = {
  name: string;
};

type BpCategory = "Normal" | "Elevated" | "Stage 1" | "Stage 2" | "Crisis";

type Reading = {
  id: string;
  systolic: number;
  diastolic: number;
  age: number;
  category: BpCategory;
  createdAt: string;
};

type Session = { email: string; loggedIn: boolean };
type Section = "Profile" | "Dashboard" | "History" | "Health Tips";

const PROFILE_KEY = "bp-dashboard-profile";
const READINGS_KEY = "bp-dashboard-readings";
const SESSION_KEY = "bp-dashboard-session";
const LOGIN_KEY = "bp-dashboard-login";
const LOGIN_ACTIVITY_KEY = "bp-dashboard-login-activity";
const sections: Section[] = ["Profile", "Dashboard", "History", "Health Tips"];

function categorizeReading(systolic: number, diastolic: number): BpCategory {
  if (systolic >= 180 || diastolic >= 120) return "Crisis";
  if (systolic >= 140 || diastolic >= 90) return "Stage 2";
  if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) {
    return "Stage 1";
  }
  if (systolic >= 120 && systolic <= 129 && diastolic < 80) return "Elevated";
  return "Normal";
}

const categoryStyles: Record<
  BpCategory,
  { ring: string; badge: string; text: string; note: string }
> = {
  Normal: {
    ring: "ring-emerald-400/60",
    badge: "bg-emerald-100 text-emerald-700",
    text: "text-emerald-700",
    note: "Great control. Keep healthy habits consistent.",
  },
  Elevated: {
    ring: "ring-yellow-400/60",
    badge: "bg-yellow-100 text-yellow-700",
    text: "text-yellow-700",
    note: "Slightly elevated. Monitor closely and reduce sodium.",
  },
  "Stage 1": {
    ring: "ring-orange-400/60",
    badge: "bg-orange-100 text-orange-700",
    text: "text-orange-700",
    note: "Hypertension stage 1. Improve lifestyle and follow medical advice.",
  },
  "Stage 2": {
    ring: "ring-red-400/60",
    badge: "bg-red-100 text-red-700",
    text: "text-red-700",
    note: "Hypertension stage 2. Seek clinical evaluation and treatment.",
  },
  Crisis: {
    ring: "ring-red-600/70",
    badge: "bg-red-600 text-white",
    text: "text-red-700",
    note: "Hypertensive crisis. Seek urgent medical care immediately.",
  },
};

const clinicalAdvice: Record<BpCategory, string[]> = {
  Normal: [
    "Continue balanced DASH-style meals with fruits, vegetables, and whole grains.",
    "Maintain regular physical activity and hydration.",
    "Recheck blood pressure weekly and continue healthy routines.",
  ],
  Elevated: [
    "Reduce sodium intake and avoid heavily processed foods.",
    "Exercise regularly (at least 150 minutes per week).",
    "Manage stress and monitor blood pressure every few days.",
  ],
  "Stage 1": [
    "Follow strict low-salt nutrition and increase fiber intake.",
    "Maintain routine exercise and sleep hygiene.",
    "Consult your doctor if readings stay elevated consistently.",
  ],
  "Stage 2": [
    "Reduce sodium aggressively and follow a DASH diet plan.",
    "Exercise regularly, manage stress, and avoid tobacco and excess alcohol.",
    "Consult your physician promptly for treatment planning and close monitoring.",
  ],
  Crisis: [
    "Retake the reading after sitting calmly for 5 minutes.",
    "If still in crisis range, seek urgent emergency care immediately.",
    "Do not delay medical treatment if severe symptoms are present.",
  ],
};

const structuredTips = [
  {
    title: "DASH Diet",
    points: [
      "Focus on fruits, vegetables, whole grains, and lean proteins.",
      "Use low-fat dairy and avoid trans-fat-rich processed meals.",
    ],
  },
  {
    title: "Sodium Intake (<1,500 mg/day)",
    points: [
      "Read nutrition labels and choose low-sodium options.",
      "Replace added salt with herbs, lemon, and natural spices.",
    ],
  },
  {
    title: "Physical Activity (150 mins/week)",
    points: [
      "Target 30 minutes of moderate activity for 5 days weekly.",
      "Include walking, cycling, or swimming plus light strength work.",
    ],
  },
  {
    title: "Stress Management",
    points: [
      "Practice deep breathing or mindfulness 10-15 minutes daily.",
      "Use healthy coping strategies and reduce chronic stress triggers.",
    ],
  },
  {
    title: "Quality Sleep",
    points: [
      "Aim for 7-9 hours of consistent sleep each night.",
      "Limit late caffeine and screen exposure before bedtime.",
    ],
  },
  {
    title: "Medication Adherence",
    points: [
      "Take prescribed medications exactly as directed by your doctor.",
      "Set reminders and never stop medication without medical advice.",
    ],
  },
  {
    title: "Limit Alcohol",
    points: [
      "Keep alcohol intake minimal and avoid binge drinking.",
      "Choose alcohol-free days each week to support BP control.",
    ],
  },
  {
    title: "Quit Smoking",
    points: [
      "Stop smoking and avoid all tobacco exposure.",
      "Seek counseling or cessation support if needed.",
    ],
  },
];

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("Dashboard");
  const [profile, setProfile] = useState<Profile>({ name: "" });
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [readingAge, setReadingAge] = useState("");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [latestSubmitted, setLatestSubmitted] = useState<Reading | null>(null);
  const [loginActivity, setLoginActivity] = useState<string[]>([]);

  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_KEY);
    const savedProfile = localStorage.getItem(PROFILE_KEY);
    const savedReadings = localStorage.getItem(READINGS_KEY);
    const savedLoginEmail = localStorage.getItem(LOGIN_KEY);
    const savedLoginActivity = localStorage.getItem(LOGIN_ACTIVITY_KEY);

    if (savedSession) setSession(JSON.parse(savedSession));
    if (savedProfile) setProfile(JSON.parse(savedProfile));
    if (savedReadings) setReadings(JSON.parse(savedReadings));
    if (savedLoginEmail) setLoginEmail(savedLoginEmail);
    if (savedLoginActivity) setLoginActivity(JSON.parse(savedLoginActivity));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(READINGS_KEY, JSON.stringify(readings));
  }, [readings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(LOGIN_ACTIVITY_KEY, JSON.stringify(loginActivity));
  }, [loginActivity, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (session?.loggedIn) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.setItem(LOGIN_KEY, session.email);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [session, hydrated]);

  const latestReading = readings[0];
  const latestCategory = latestReading?.category ?? "Normal";
  const style = categoryStyles[latestCategory];
  const displayName = profile.name || session?.email || "User";

  const chartData = useMemo(
    () =>
      [...readings]
        .reverse()
        .map((reading) => ({
          time: new Date(reading.createdAt).toLocaleDateString([], { month: "short", day: "numeric" }),
          systolic: reading.systolic,
          diastolic: reading.diastolic,
        })),
    [readings]
  );

  const downloadPdfReport = () => {
    const doc = new jsPDF();
    const now = new Date().toLocaleString();
    doc.setFontSize(18);
    doc.text("Professional Blood Pressure Report", 14, 18);
    doc.setFontSize(11);
    doc.text(`Generated: ${now}`, 14, 26);
    doc.text(`User: ${displayName}`, 14, 32);
    doc.text(`Email: ${session?.email ?? "-"}`, 14, 38);
    doc.text(`Current Status: ${latestCategory}`, 14, 44);
    if (latestReading) {
      doc.text(`Latest Reading: ${latestReading.systolic}/${latestReading.diastolic} mmHg`, 14, 50);
      doc.text(`Age at Latest Reading: ${latestReading.age}`, 14, 56);
    }

    doc.setFontSize(13);
    doc.text("Reading History", 14, 66);
    doc.setFontSize(10);

    let y = 74;
    if (readings.length === 0) {
      doc.text("No readings available.", 14, y);
    } else {
      doc.text("Timestamp", 14, y);
      doc.text("Sys", 88, y);
      doc.text("Dia", 104, y);
      doc.text("Age", 120, y);
      doc.text("Category", 136, y);
      y += 5;
      doc.line(14, y, 196, y);
      y += 6;

      for (const reading of readings) {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(new Date(reading.createdAt).toLocaleString(), 14, y);
        doc.text(String(reading.systolic), 88, y);
        doc.text(String(reading.diastolic), 104, y);
        doc.text(String(reading.age), 120, y);
        doc.text(reading.category, 136, y);
        y += 6;
      }
    }

    doc.save(`bp-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const addReading = (event: FormEvent) => {
    event.preventDefault();
    const sys = Number(systolic);
    const dia = Number(diastolic);
    const age = Number(readingAge);
    if (!Number.isFinite(sys) || !Number.isFinite(dia) || !Number.isFinite(age)) return;
    if (sys < 70 || dia < 40 || age < 1) return;

    const entry: Reading = {
      id: crypto.randomUUID(),
      systolic: sys,
      diastolic: dia,
      age,
      category: categorizeReading(sys, dia),
      createdAt: new Date().toISOString(),
    };

    setReadings((prev) => [entry, ...prev]);
    setLatestSubmitted(entry);
    setShowResultModal(true);
    setSystolic("");
    setDiastolic("");
    setReadingAge("");
  };

  const deleteReading = (id: string) => {
    setReadings((prev) => prev.filter((r) => r.id !== id));
  };

  const handleLogin = (event: FormEvent) => {
    event.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) return;
    const loginTimestamp = new Date().toISOString();
    setLoginActivity((prev) => [loginTimestamp, ...prev].slice(0, 20));
    setSession({ email: loginEmail.trim(), loggedIn: true });
    setLoginPassword("");
    setActiveSection("Dashboard");
  };

  const handleLogout = () => {
    setSession(null);
    setLoginPassword("");
    setActiveSection("Dashboard");
  };

  const renderProfile = () => (
    <section className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-blue-100">
      <h2 className="text-xl font-semibold text-slate-900">Profile</h2>
      <p className="mt-1 text-sm text-slate-500">Update your personal details for reporting.</p>
      <div className="mt-5 grid gap-3 sm:max-w-md">
        <input
          value={profile.name}
          onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
          className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm outline-none ring-blue-300 focus:ring"
          placeholder="Full Name"
        />
      </div>

      <div className="mt-5 rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100">
        <p className="text-sm font-semibold text-blue-700">Login Activity</p>
        <p className="mt-2 text-sm text-slate-700">
          Last Login:{" "}
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
            {loginActivity[0]
              ? new Date(loginActivity[0]).toLocaleString([], {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "No login recorded yet"}
          </span>
        </p>
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Recent Logins</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {loginActivity.slice(0, 3).map((item) => (
              <li key={item}>- {new Date(item).toLocaleString()}</li>
            ))}
            {loginActivity.length === 0 ? <li>- No entries available</li> : null}
          </ul>
        </div>
      </div>
    </section>
  );

  const renderHistoryTable = () => (
    <section className="rounded-3xl bg-white p-5 shadow-xl ring-1 ring-slate-100">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">History</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">{readings.length} total readings</span>
          <button
            type="button"
            onClick={downloadPdfReport}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Download PDF Report
          </button>
        </div>
      </div>
      <div className="mt-4 overflow-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-3 py-2 font-medium">Timestamp</th>
              <th className="px-3 py-2 font-medium">Systolic</th>
              <th className="px-3 py-2 font-medium">Diastolic</th>
              <th className="px-3 py-2 font-medium">Age</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Delete</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((reading) => (
              <tr key={reading.id} className="border-b border-slate-100">
                <td className="px-3 py-2 text-slate-600">{new Date(reading.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2 font-semibold text-blue-700">{reading.systolic}</td>
                <td className="px-3 py-2 font-semibold text-orange-600">{reading.diastolic}</td>
                <td className="px-3 py-2 text-slate-700">{reading.age}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${categoryStyles[reading.category].badge}`}
                  >
                    {reading.category}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => deleteReading(reading.id)}
                    className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100"
                    aria-label="Delete reading"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {readings.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No saved readings in localStorage yet.</p>
        ) : null}
      </div>
    </section>
  );

  const renderHealthTips = () => (
    <section className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-blue-100">
      <h2 className="text-xl font-semibold text-slate-900">Health Tips</h2>
      <p className="mt-1 text-sm text-slate-500">
        Structured prevention plan for status:{" "}
        <span className={`font-semibold ${categoryStyles[latestCategory].text}`}>{latestCategory}</span>
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {structuredTips.map((tip) => (
          <article key={tip.title} className="rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100">
            <h3 className="text-sm font-semibold text-blue-700">{tip.title}</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {tip.points.map((point) => (
                <li key={point}>- {point}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );

  const renderDashboard = () => (
    <>
      <section className="rounded-3xl bg-white/90 p-6 shadow-xl ring-1 ring-blue-100 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Welcome back, {session?.email}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Patient: {displayName} | Professional monitoring with AHA trend insights.
            </p>
          </div>
          <div className={`rounded-2xl p-4 ring-2 ${style.ring}`}>
            <p className="text-xs uppercase tracking-wide text-slate-500">Current Status</p>
            <p className={`mt-1 text-xl font-semibold ${style.text}`}>{latestCategory}</p>
            {latestReading ? (
              <p className="mt-1 text-sm text-slate-600">
                {latestReading.systolic}/{latestReading.diastolic} mmHg
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-600">No readings yet</p>
            )}
          </div>
        </div>

        <form onSubmit={addReading} className="mt-6 grid gap-3 md:grid-cols-4">
          <input
            value={systolic}
            onChange={(event) => setSystolic(event.target.value)}
            type="number"
            min={70}
            className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm outline-none ring-blue-300 focus:ring"
            placeholder="Systolic"
            required
          />
          <input
            value={diastolic}
            onChange={(event) => setDiastolic(event.target.value)}
            type="number"
            min={40}
            className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm outline-none ring-blue-300 focus:ring"
            placeholder="Diastolic"
            required
          />
          <input
            value={readingAge}
            onChange={(event) => setReadingAge(event.target.value)}
            type="number"
            min={1}
            className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm outline-none ring-blue-300 focus:ring"
            placeholder="Age"
            required
          />
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Add Reading
          </button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(["Normal", "Elevated", "Stage 1", "Stage 2"] as BpCategory[]).map((category) => (
          <div
            key={category}
            className={`rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-100 ${
              latestCategory === category ? "ring-2 ring-offset-1" : ""
            } ${categoryStyles[category].ring}`}
          >
            <div
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${categoryStyles[category].badge}`}
            >
              {category}
            </div>
            <p className="mt-3 text-sm text-slate-600">{categoryStyles[category].note}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-xl ring-1 ring-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Blood Pressure Trend</h2>
            <p className="text-sm text-slate-500">Systolic and diastolic readings over time</p>
          </div>
          <button
            type="button"
            onClick={downloadPdfReport}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Download PDF Report
          </button>
        </div>
        <div className="h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis domain={[40, 200]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="systolic" stroke="#2563eb" strokeWidth={3} dot />
              <Line type="monotone" dataKey="diastolic" stroke="#f97316" strokeWidth={3} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );

  if (!hydrated) return <div className="min-h-screen bg-blue-50" />;

  if (!session?.loggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 p-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl ring-1 ring-blue-100">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A4.5 4.5 0 0 1 6.5 4c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 12 7.15a6 6 0 0 1 1-1.06A5.93 5.93 0 0 1 17.5 4 4.5 4.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-blue-600">Blood Pressure Pro</p>
              <h1 className="text-xl font-semibold text-slate-900">Professional Login</h1>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder="Email"
              className="w-full rounded-xl border border-blue-200 px-4 py-3 text-sm outline-none ring-blue-300 focus:ring"
              required
            />
            <input
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border border-blue-200 px-4 py-3 text-sm outline-none ring-blue-300 focus:ring"
              required
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 p-5 text-slate-800">
      <div className="mx-auto grid w-full max-w-7xl gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-3xl bg-white/90 p-5 shadow-xl ring-1 ring-blue-100 backdrop-blur">
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-4 text-white shadow-lg">
            <p className="text-xs uppercase tracking-wide text-blue-100">Blood Pressure Pro</p>
            <h2 className="mt-1 text-lg font-semibold">Tracking Dashboard</h2>
          </div>
          <nav className="space-y-2">
            {sections.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setActiveSection(item)}
                className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                  activeSection === item
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="mt-6 rounded-2xl bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Logged In As</p>
            <p className="mt-2 text-sm font-medium text-slate-700">{session.email}</p>
            <p className="text-xs text-slate-500">Name: {profile.name || "Not set"}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-6 w-full rounded-xl bg-red-50 px-4 py-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-100"
          >
            Logout
          </button>
        </aside>

        <main className="space-y-5">
          {activeSection === "Dashboard" && renderDashboard()}
          {activeSection === "Profile" && renderProfile()}
          {activeSection === "History" && renderHistoryTable()}
          {activeSection === "Health Tips" && renderHealthTips()}
        </main>
      </div>

      {showResultModal && latestSubmitted ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-red-200">
            <div className="bg-red-600 px-6 py-4 text-white">
              <p className="text-xs uppercase tracking-wide text-red-100">Classification</p>
              <h3 className="text-2xl font-semibold">{latestSubmitted.category}</h3>
            </div>
            <div className="space-y-4 p-6">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-600">
                  Reading:{" "}
                  <span className="font-semibold text-slate-900">
                    {latestSubmitted.systolic}/{latestSubmitted.diastolic} mmHg
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Age: <span className="font-semibold text-slate-900">{latestSubmitted.age}</span>
                </p>
              </div>

              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-700">Recommendation</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {clinicalAdvice[latestSubmitted.category].map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-medium text-emerald-700">Reading saved to local storage</p>
                <button
                  type="button"
                  onClick={downloadPdfReport}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M12 16l4-5h-3V4h-2v7H8l4 5zm-7 2h14v2H5v-2z" />
                  </svg>
                  PDF Download
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowResultModal(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
