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
  age: string;
};

type BpCategory = "Normal" | "Elevated" | "Stage 1" | "Stage 2" | "Crisis";

type Reading = {
  id: string;
  systolic: number;
  diastolic: number;
  category: BpCategory;
  createdAt: string;
};

type Session = { email: string; loggedIn: boolean };

const PROFILE_KEY = "bp-dashboard-profile";
const READINGS_KEY = "bp-dashboard-readings";
const SESSION_KEY = "bp-dashboard-session";
const LOGIN_KEY = "bp-dashboard-login";
const sections = ["Profile", "Dashboard", "History", "Health Tips"] as const;
type Section = (typeof sections)[number];

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

const healthTips: Record<BpCategory, string[]> = {
  Normal: [
    "Maintain 150 minutes of weekly exercise and regular sleep.",
    "Keep sodium below 2300mg/day and stay hydrated.",
    "Continue monthly blood pressure monitoring for prevention.",
  ],
  Elevated: [
    "Reduce salt and processed foods; increase vegetables and fruit.",
    "Walk briskly for 30 minutes at least 5 days per week.",
    "Track blood pressure every 2-3 days and avoid smoking.",
  ],
  "Stage 1": [
    "Follow DASH-style meals with low sodium and more potassium foods.",
    "Limit caffeine and alcohol, and manage stress daily.",
    "Consult a doctor if values remain high for several weeks.",
  ],
  "Stage 2": [
    "Use strict low-sodium diet (<1500mg/day) and portion control.",
    "Take prescribed medication consistently and log adherence.",
    "Book regular physician follow-ups and monitor BP daily.",
  ],
  Crisis: [
    "Sit calmly and repeat measurement after 5 minutes.",
    "If still crisis range, seek urgent/emergency medical care immediately.",
    "Do not delay treatment, especially with chest pain or headache.",
  ],
};

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("Dashboard");
  const [profile, setProfile] = useState<Profile>({ name: "", age: "" });
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_KEY);
    const savedProfile = localStorage.getItem(PROFILE_KEY);
    const savedReadings = localStorage.getItem(READINGS_KEY);
    const savedLoginEmail = localStorage.getItem(LOGIN_KEY);

    if (savedSession) setSession(JSON.parse(savedSession));
    if (savedProfile) setProfile(JSON.parse(savedProfile));
    if (savedReadings) setReadings(JSON.parse(savedReadings));
    if (savedLoginEmail) setLoginEmail(savedLoginEmail);
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
          time: new Date(reading.createdAt).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          }),
          systolic: reading.systolic,
          diastolic: reading.diastolic,
        })),
    [readings]
  );

  const addReading = (event: FormEvent) => {
    event.preventDefault();
    const sys = Number(systolic);
    const dia = Number(diastolic);

    if (!Number.isFinite(sys) || !Number.isFinite(dia) || sys < 70 || dia < 40) return;

    const entry: Reading = {
      id: crypto.randomUUID(),
      systolic: sys,
      diastolic: dia,
      category: categorizeReading(sys, dia),
      createdAt: new Date().toISOString(),
    };

    setReadings((prev) => [entry, ...prev]);
    setSystolic("");
    setDiastolic("");
  };

  const handleLogin = (event: FormEvent) => {
    event.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) return;
    setSession({ email: loginEmail.trim(), loggedIn: true });
    setLoginPassword("");
    setActiveSection("Dashboard");
  };

  const handleLogout = () => {
    setSession(null);
    setLoginPassword("");
    setActiveSection("Dashboard");
  };

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
      doc.text(
        `Latest Reading: ${latestReading.systolic}/${latestReading.diastolic} mmHg`,
        14,
        50
      );
    }

    doc.setFontSize(13);
    doc.text("Reading History", 14, 60);
    doc.setFontSize(10);

    let y = 68;
    if (readings.length === 0) {
      doc.text("No readings available.", 14, y);
    } else {
      doc.text("Timestamp", 14, y);
      doc.text("Sys", 95, y);
      doc.text("Dia", 115, y);
      doc.text("Category", 135, y);
      y += 5;
      doc.line(14, y, 196, y);
      y += 6;

      for (const reading of readings) {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(new Date(reading.createdAt).toLocaleString(), 14, y);
        doc.text(String(reading.systolic), 95, y);
        doc.text(String(reading.diastolic), 115, y);
        doc.text(reading.category, 135, y);
        y += 6;
      }
    }

    doc.save(`bp-report-${new Date().toISOString().slice(0, 10)}.pdf`);
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
        <input
          value={profile.age}
          onChange={(event) => setProfile((prev) => ({ ...prev, age: event.target.value }))}
          className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm outline-none ring-blue-300 focus:ring"
          placeholder="Age"
        />
      </div>
      <p className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
        Saved locally on this browser. Current name: {profile.name || "Not set"}
      </p>
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
        <table className="w-full min-w-[580px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-3 py-2 font-medium">Timestamp</th>
              <th className="px-3 py-2 font-medium">Systolic</th>
              <th className="px-3 py-2 font-medium">Diastolic</th>
              <th className="px-3 py-2 font-medium">Category</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((reading) => (
              <tr key={reading.id} className="border-b border-slate-100">
                <td className="px-3 py-2 text-slate-600">
                  {new Date(reading.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 font-semibold text-blue-700">{reading.systolic}</td>
                <td className="px-3 py-2 font-semibold text-orange-600">{reading.diastolic}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${categoryStyles[reading.category].badge}`}
                  >
                    {reading.category}
                  </span>
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
        Advice based on current status:{" "}
        <span className={`font-semibold ${categoryStyles[latestCategory].text}`}>{latestCategory}</span>
      </p>
      <div className="mt-5 rounded-2xl bg-blue-50 p-4">
        <ul className="space-y-2 text-sm text-slate-700">
          {healthTips[latestCategory].map((tip) => (
            <li key={tip}>- {tip}</li>
          ))}
        </ul>
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

        <form onSubmit={addReading} className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            value={systolic}
            onChange={(event) => setSystolic(event.target.value)}
            type="number"
            min={70}
            className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm outline-none ring-blue-300 focus:ring"
            placeholder="Systolic (e.g. 120)"
            required
          />
          <input
            value={diastolic}
            onChange={(event) => setDiastolic(event.target.value)}
            type="number"
            min={40}
            className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm outline-none ring-blue-300 focus:ring"
            placeholder="Diastolic (e.g. 80)"
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
        <div className="h-72 w-full">
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
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
                aria-hidden="true"
              >
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
          <p className="mt-4 text-center text-xs text-slate-500">
            Demo mode: any email and password will log in.
          </p>
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
    </div>
  );
}
