"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import type { Session } from "@supabase/supabase-js";
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
import { Activity, Eye, EyeOff, Heart, Moon, Sun, User } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  name: string;
};

type BpCategory = "Normal" | "Elevated" | "Stage 1" | "Stage 2" | "Crisis";

type Reading = {
  id: string;
  systolic: number;
  diastolic: number;
  /** Stored in Supabase `readings.pulse` column (schema unchanged). */
  age: number;
  category: BpCategory;
  createdAt: string;
};

type Section = "Profile" | "Dashboard" | "History" | "Health Tips";

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

/** ACC/AHA-style reference ranges for patient education (PDF + UI context). */
const ahaJnc8ReferenceRows: { category: BpCategory; systolic: string; diastolic: string }[] = [
  { category: "Normal", systolic: "<120 mmHg", diastolic: "<80 mmHg" },
  { category: "Elevated", systolic: "120–129 mmHg", diastolic: "<80 mmHg" },
  { category: "Stage 1", systolic: "130–139 mmHg", diastolic: "80–89 mmHg" },
  { category: "Stage 2", systolic: "≥140 mmHg", diastolic: "≥90 mmHg" },
  { category: "Crisis", systolic: "≥180 mmHg", diastolic: "≥120 mmHg" },
];

const modalHeaderClass: Record<BpCategory, string> = {
  Normal: "bg-emerald-600",
  Elevated: "bg-amber-500",
  "Stage 1": "bg-orange-500",
  "Stage 2": "bg-red-600",
  Crisis: "bg-red-800",
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

const dataCardClass =
  "rounded-[12px] border border-slate-100 bg-white p-5 shadow-[0_2px_16px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_4px_24px_rgba(37,99,235,0.08)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none dark:hover:shadow-lg dark:hover:shadow-black/30";

const shellCardClass =
  "rounded-[12px] border border-slate-100 bg-white shadow-[0_2px_20px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none";

const primaryBtnClass =
  "rounded-xl bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900";

const bpFormCardClass =
  "rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-[#252525]";

function getUserInitials(name: string, email: string): string {
  const n = name.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const e = email.trim();
  if (!e) return "?";
  return e.slice(0, 2).toUpperCase();
}

function formatLongDate(d: string | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "—";
  }
}

function formatDateTimeLocal(d: string | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

const THEME_STORAGE_KEY = "hb-theme";

const INVALID_EMAIL_MSG = "Please enter a valid email address.";

/** Simple format check: local@domain with domain containing a dot and TLD (2+ chars). */
function isValidEmailFormat(email: string): boolean {
  const t = email.trim();
  if (!t.includes("@")) return false;
  const parts = t.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (!domain.includes(".")) return false;
  const domainParts = domain.split(".");
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2) return false;
  return true;
}

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
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authMessage, setAuthMessage] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showAddReadingModal, setShowAddReadingModal] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [latestSubmitted, setLatestSubmitted] = useState<Reading | null>(null);
  const [saveError, setSaveError] = useState("");
  const [bpFormWarning, setBpFormWarning] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [saveSuccessToast, setSaveSuccessToast] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const fetchReadings = async (userId: string) => {
    const { data, error } = await supabase
      .from("readings")
      .select("id, systolic, diastolic, pulse, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      setFetchError(error.message);
      return;
    }

    setFetchError("");
    setReadings(
      (data ?? []).map((row) => ({
        id: row.id,
        systolic: row.systolic,
        diastolic: row.diastolic,
        age: row.pulse,
        category: categorizeReading(row.systolic, row.diastolic),
        createdAt: row.created_at,
      }))
    );
  };

  useEffect(() => {
    const bootAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setAuthLoading(false);
      if (data.session?.user) {
        setLoginEmail(data.session.user.email ?? "");
        await fetchReadings(data.session.user.id);
      }
    };

    void bootAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoginEmail(nextSession?.user.email ?? "");
      if (!nextSession?.user) {
        setReadings([]);
      } else {
        void fetchReadings(nextSession.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!saveSuccessToast) return;
    const t = window.setTimeout(() => setSaveSuccessToast(false), 3200);
    return () => window.clearTimeout(t);
  }, [saveSuccessToast]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "dark") setDarkMode(true);
      else if (stored === "light") setDarkMode(false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, darkMode ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, [darkMode]);

  const latestReading = readings[0];
  const latestCategory = latestReading?.category ?? "Normal";
  const style = categoryStyles[latestCategory];
  const displayName = profile.name || session?.user.email || "User";

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
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentW = pageW - margin * 2;
    let y = margin;

    const ensureSpace = (needed: number) => {
      const pageH = doc.internal.pageSize.getHeight();
      if (y + needed > pageH - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const sectionTitle = (title: string) => {
      ensureSpace(14);
      doc.setFillColor(37, 99, 235);
      doc.rect(margin, y - 2, contentW, 9, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin + 2, y + 4);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      y += 12;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text("Hypertension Buddy - Blood Pressure Report", margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 10;
    doc.setTextColor(0, 0, 0);

    sectionTitle("Patient");
    doc.setFontSize(10);
    doc.text(`Patient Name: ${displayName}`, margin, y);
    y += 6;
    const ageForReport = latestReading?.age;
    doc.text(`Age (at latest reading): ${ageForReport != null ? String(ageForReport) : "—"}`, margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Account email (reference): ${session?.user.email ?? "—"}`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    sectionTitle("Current summary");
    doc.setFontSize(10);
    doc.text(`Classification: ${latestCategory}`, margin, y);
    y += 6;
    if (latestReading) {
      doc.text(
        `Latest BP: ${latestReading.systolic}/${latestReading.diastolic} mmHg  |  Age recorded: ${latestReading.age}`,
        margin,
        y
      );
      y += 6;
    } else {
      doc.text("No readings on file.", margin, y);
      y += 6;
    }

    sectionTitle("AHA / JNC 8 reference (education)");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Category", margin, y);
    doc.text("Systolic", margin + 58, y);
    doc.text("Diastolic", margin + 110, y);
    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, margin + contentW, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    for (const row of ahaJnc8ReferenceRows) {
      ensureSpace(8);
      doc.text(row.category, margin, y);
      doc.text(row.systolic, margin + 58, y);
      doc.text(row.diastolic, margin + 110, y);
      y += 6;
    }
    y += 4;

    sectionTitle("Recommendations (based on latest classification)");
    doc.setFontSize(9);
    const recLines: string[] = [
      ...clinicalAdvice[latestCategory],
      "Lifestyle: DASH-style nutrition, limit sodium, 150+ min/week activity, stress care, sleep 7–9h.",
    ];
    for (const line of recLines) {
      const wrapped = doc.splitTextToSize(`• ${line}`, contentW - 4);
      for (const wline of wrapped) {
        ensureSpace(5);
        doc.text(wline, margin + 2, y);
        y += 5;
      }
    }
    y += 4;

    sectionTitle("Reading history");
    doc.setFontSize(9);
    if (readings.length === 0) {
      doc.text("No readings available.", margin, y);
      y += 6;
    } else {
      doc.setFont("helvetica", "bold");
      doc.text("Timestamp", margin, y);
      doc.text("Sys", margin + 78, y);
      doc.text("Dia", margin + 92, y);
      doc.text("Age", margin + 106, y);
      doc.text("Category", margin + 122, y);
      y += 4;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, margin + contentW, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      for (const reading of readings) {
        const tsLines = doc.splitTextToSize(new Date(reading.createdAt).toLocaleString(), 62);
        ensureSpace(Math.max(6, tsLines.length * 5 + 2));
        doc.text(tsLines, margin, y);
        doc.text(String(reading.systolic), margin + 78, y);
        doc.text(String(reading.diastolic), margin + 92, y);
        doc.text(String(reading.age), margin + 106, y);
        doc.text(reading.category, margin + 122, y);
        y += Math.max(6, tsLines.length * 5);
      }
    }

    doc.save(`hypertension-buddy-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const addReading = async (event: FormEvent) => {
    event.preventDefault();
    if (!session?.user) return;

    const ageStr = readingAge.trim();
    const sysStr = systolic.trim();
    const diaStr = diastolic.trim();
    if (!ageStr || !sysStr || !diaStr) {
      setBpFormWarning("Please fill in Age, Systolic, and Diastolic before submitting.");
      setSaveError("");
      return;
    }

    const sys = Number(sysStr);
    const dia = Number(diaStr);
    const age = Number(ageStr);
    if (!Number.isFinite(sys) || !Number.isFinite(dia) || !Number.isFinite(age)) {
      setBpFormWarning("Please enter valid numbers for all fields.");
      return;
    }
    if (sys < 70 || dia < 40 || age < 1) {
      setBpFormWarning("Check your values: age ≥ 1, systolic ≥ 70, diastolic ≥ 40.");
      return;
    }

    setBpFormWarning("");
    setSaveError("");
    const { data, error } = await supabase
      .from("readings")
      .insert({
        user_id: session.user.id,
        systolic: sys,
        diastolic: dia,
        pulse: age,
      })
      .select("id, systolic, diastolic, pulse, created_at")
      .single();

    if (error || !data) {
      setSaveError(error?.message ?? "Could not save reading.");
      return;
    }

    const entry: Reading = {
      id: data.id,
      systolic: data.systolic,
      diastolic: data.diastolic,
      age: data.pulse,
      category: categorizeReading(data.systolic, data.diastolic),
      createdAt: data.created_at,
    };

    setReadings((prev) => [entry, ...prev]);
    setLatestSubmitted(entry);
    setShowAddReadingModal(false);
    setShowResultModal(true);
    setSaveSuccessToast(true);
    setSystolic("");
    setDiastolic("");
    setReadingAge("");
  };

  const deleteReading = async (id: string) => {
    if (!session?.user) return;
    const { error } = await supabase.from("readings").delete().eq("id", id).eq("user_id", session.user.id);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setReadings((prev) => prev.filter((r) => r.id !== id));
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) return;

    if (!isValidEmailFormat(loginEmail)) {
      setAuthMessage(INVALID_EMAIL_MSG);
      return;
    }

    setAuthMessage("");
    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (error) {
        setAuthMessage(error.message);
        return;
      }
      setAuthMessage("Signup successful. Check your email to confirm your account.");
      setLoginPassword("");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    if (error) {
      setAuthMessage(error.message);
      return;
    }

    setLoginPassword("");
    setAuthMessage("");
    setActiveSection("Dashboard");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLoginPassword("");
    setAuthMessage("");
    setActiveSection("Dashboard");
  };

  const renderProfile = () => {
    const u = session?.user;
    const email = u?.email ?? "—";
    const initials = getUserInitials(profile.name, email === "—" ? "" : email);
    const memberSince = formatLongDate(u?.created_at);
    const accountCreated = formatDateTimeLocal(u?.created_at);
    const lastSignIn = formatDateTimeLocal(u?.last_sign_in_at);

    return (
      <div className="space-y-6">
        <section className={`${shellCardClass} overflow-hidden`}>
          <div className="border-b border-slate-100 bg-gradient-to-br from-[#2563eb]/5 to-white px-6 py-8 dark:border-zinc-800 dark:from-[#2563eb]/15 dark:to-zinc-900 sm:px-8">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
              <div
                className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-2xl font-semibold text-white shadow-[0_4px_20px_rgba(37,99,235,0.35)]"
                aria-hidden
              >
                {initials}
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">Your profile</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">{email}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
                  Member since <span className="font-medium text-slate-700 dark:text-zinc-200">{memberSince}</span>
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-8">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Display name (for reports)
            </label>
            <input
              value={profile.name}
              onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-2 w-full max-w-md rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="Full name"
            />
          </div>
        </section>

        <section className={`${shellCardClass} p-6 sm:p-8`}>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">Personal information</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Account details from your secure session.</p>
          <ul className="mt-6 divide-y divide-slate-100 dark:divide-zinc-800">
            <li className="flex gap-4 py-4 first:pt-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#2563eb]/10 text-[#2563eb] dark:bg-blue-500/20 dark:text-blue-400">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">Email</p>
                <p className="mt-0.5 break-all text-sm font-medium text-slate-900 dark:text-zinc-50">{email}</p>
              </div>
            </li>
            <li className="flex gap-4 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#2563eb]/10 text-[#2563eb] dark:bg-blue-500/20 dark:text-blue-400">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">Account created</p>
                <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-zinc-50">{accountCreated}</p>
              </div>
            </li>
            <li className="flex gap-4 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#2563eb]/10 text-[#2563eb] dark:bg-blue-500/20 dark:text-blue-400">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">Last sign in</p>
                <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-zinc-50">{lastSignIn}</p>
              </div>
            </li>
            <li className="flex gap-4 py-4 last:pb-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#2563eb]/10 text-[#2563eb] dark:bg-blue-500/20 dark:text-blue-400">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">User ID</p>
                <p className="mt-0.5 break-all font-mono text-xs font-medium text-slate-800 dark:text-zinc-200">{u?.id ?? "—"}</p>
              </div>
            </li>
          </ul>
        </section>
      </div>
    );
  };

  const renderHistoryTable = () => (
    <section className={`${shellCardClass} p-5 sm:p-6`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">History</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">{readings.length} total readings</p>
        </div>
        <button type="button" onClick={downloadPdfReport} className={`${primaryBtnClass} w-full sm:w-auto`}>
          Download PDF report
        </button>
      </div>
      <div className="mt-4 overflow-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
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
              <tr key={reading.id} className="border-b border-slate-100 dark:border-zinc-800">
                <td className="px-3 py-2 text-slate-600 dark:text-zinc-300">
                  {new Date(reading.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 font-semibold text-blue-700 dark:text-blue-400">{reading.systolic}</td>
                <td className="px-3 py-2 font-semibold text-orange-600 dark:text-orange-400">{reading.diastolic}</td>
                <td className="px-3 py-2 text-slate-700 dark:text-zinc-300">{reading.age}</td>
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
                    className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-950/70"
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
          <p className="mt-4 text-sm text-slate-500 dark:text-zinc-400">No readings saved in Supabase yet.</p>
        ) : null}
        {fetchError ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">Load error: {fetchError}</p>
        ) : null}
      </div>
    </section>
  );

  const renderHealthTips = () => (
    <section className={`${shellCardClass} p-6 sm:p-8`}>
      <h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">Health Tips</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
        Structured prevention plan for status:{" "}
        <span className={`font-semibold ${categoryStyles[latestCategory].text}`}>{latestCategory}</span>
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {structuredTips.map((tip) => (
          <article
            key={tip.title}
            className="rounded-[12px] border border-slate-100 bg-slate-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-800/50"
          >
            <h3 className="text-sm font-semibold text-[#2563eb] dark:text-blue-400">{tip.title}</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-zinc-300">
              {tip.points.map((point) => (
                <li key={point}>- {point}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );

  const closeAddReadingModal = () => {
    setShowAddReadingModal(false);
    setSystolic("");
    setDiastolic("");
    setReadingAge("");
    setSaveError("");
    setBpFormWarning("");
  };

  const renderDashboard = () => {
    const axisColor = darkMode ? "#a1a1aa" : "#64748b";
    const gridStroke = darkMode ? "#3f3f46" : "#dbeafe";
    return (
      <>
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(["Normal", "Elevated", "Stage 1", "Stage 2"] as BpCategory[]).map((category) => (
            <div
              key={category}
              className={`${dataCardClass} ${
                latestCategory === category ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 ${categoryStyles[category].ring}` : ""
              }`}
            >
              <div
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${categoryStyles[category].badge}`}
              >
                {category}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
                {categoryStyles[category].note}
              </p>
            </div>
          ))}
        </section>

        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => {
              setSaveError("");
              setBpFormWarning("");
              setShowAddReadingModal(true);
            }}
            className={`${primaryBtnClass} w-full lg:w-auto lg:self-start`}
          >
            + Add New Reading
          </button>
        </div>

        <section className={`${shellCardClass} p-5 sm:p-6`}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">Blood pressure trend</h2>
              <p className="text-sm text-slate-500 dark:text-zinc-400">Systolic and diastolic over time</p>
            </div>
            <button type="button" onClick={downloadPdfReport} className={`${primaryBtnClass} w-full sm:w-auto`}>
              Download PDF report
            </button>
          </div>
          <div className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: axisColor }} />
                <YAxis domain={[40, 200]} tick={{ fontSize: 12, fill: axisColor }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: darkMode ? "#27272a" : "#fff",
                    border: darkMode ? "1px solid #3f3f46" : "1px solid #e2e8f0",
                    borderRadius: 12,
                    color: darkMode ? "#fafafa" : "#0f172a",
                  }}
                />
                <Legend wrapperStyle={{ color: axisColor }} />
                <Line type="monotone" dataKey="systolic" stroke="#2563eb" strokeWidth={3} dot />
                <Line type="monotone" dataKey="diastolic" stroke="#f97316" strokeWidth={3} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </>
    );
  };

  if (authLoading) return <div className="min-h-screen bg-slate-50 dark:bg-zinc-950" />;

  const themeToggle = (
    <button
      type="button"
      onClick={() => setDarkMode((d) => !d)}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {darkMode ? <Sun className="h-5 w-5" strokeWidth={2} /> : <Moon className="h-5 w-5" strokeWidth={2} />}
    </button>
  );

  if (!session?.user) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/80 px-4 py-6 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 sm:px-6">
        <div className="fixed right-4 top-[max(12px,env(safe-area-inset-top,0px))] z-50 sm:right-5 sm:top-5">
          {themeToggle}
        </div>
        <div className={`mx-auto w-[90%] max-w-md ${shellCardClass} p-6 sm:p-8`}>
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#2563eb] text-white shadow-md">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A4.5 4.5 0 0 1 6.5 4c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 12 7.15a6 6 0 0 1 1-1.06A5.93 5.93 0 0 1 17.5 4 4.5 4.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54z" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-[#2563eb] dark:text-blue-400">Hypertension Buddy</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-zinc-50">Professional Login</h1>
          </div>
          <form
            onSubmit={(event) => void handleLogin(event)}
            className="mx-auto flex w-full max-w-full flex-col items-stretch space-y-3"
          >
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              value={loginEmail}
              onChange={(event) => {
                setLoginEmail(event.target.value);
                if (authMessage === INVALID_EMAIL_MSG) setAuthMessage("");
              }}
              placeholder="Email"
              className="login-email-input w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-gray-500 caret-neutral-900 outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500"
              required
            />
            <div className="relative isolate">
              <input
                type={showLoginPassword ? "text" : "password"}
                autoComplete="current-password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder="Password"
                className="login-password-input w-full rounded-[12px] border border-slate-200 bg-white py-3 pl-4 pr-12 text-sm text-neutral-900 placeholder:text-gray-500 caret-neutral-900 outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                required
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowLoginPassword((v) => !v);
                }}
                className="absolute right-1.5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 shrink-0 items-center justify-center rounded-lg text-gray-700 transition hover:bg-slate-100 hover:text-gray-900 active:scale-95 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
                aria-label={showLoginPassword ? "Hide password" : "Show password"}
                aria-pressed={showLoginPassword}
              >
                {showLoginPassword ? (
                  <EyeOff className="pointer-events-none h-5 w-5 shrink-0" strokeWidth={2} />
                ) : (
                  <Eye className="pointer-events-none h-5 w-5 shrink-0" strokeWidth={2} />
                )}
              </button>
            </div>
            <button type="submit" className={`${primaryBtnClass} mx-auto w-full max-w-full`}>
              {authMode === "login" ? "Login" : "Create account"}
            </button>
            <button
              type="button"
              className="mx-auto w-full max-w-full rounded-[12px] bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              onClick={() => {
                setAuthMode((prev) => (prev === "login" ? "signup" : "login"));
                setAuthMessage("");
                setShowLoginPassword(false);
              }}
            >
              {authMode === "login" ? "Need an account? Sign up" : "Already have an account? Login"}
            </button>
            {authMessage ? (
              <p
                className={`text-center text-sm font-medium ${
                  authMessage === INVALID_EMAIL_MSG
                    ? "text-red-600 dark:text-red-400"
                    : "text-blue-700 dark:text-blue-300"
                }`}
                role={authMessage === INVALID_EMAIL_MSG ? "alert" : undefined}
              >
                {authMessage}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/60 text-slate-800 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100">
      <div className="fixed right-4 top-[max(12px,env(safe-area-inset-top,0px))] z-[45] sm:right-5 sm:top-5">
        {themeToggle}
      </div>

      {saveSuccessToast ? (
        <div
          className="fixed left-1/2 top-4 z-[80] flex max-w-[min(90vw,360px)] items-center gap-2 rounded-[12px] border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 shadow-lg ring-1 ring-emerald-100 dark:border-emerald-800 dark:bg-zinc-800 dark:text-emerald-300 dark:ring-emerald-900"
          style={{ animation: "success-toast-in 0.35s ease-out both" }}
          role="status"
          aria-live="polite"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
            style={{ animation: "success-check-pop 0.45s ease-out both" }}
            aria-hidden
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span>Success! Reading saved.</span>
        </div>
      ) : null}

      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-3 pr-16 shadow-sm backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          aria-label="Open menu"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="truncate text-center text-sm font-semibold text-slate-900 dark:text-zinc-50">Hypertension Buddy</span>
        <span className="w-11 shrink-0" aria-hidden />
      </header>

      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[min(280px,88vw)] transform border-r border-slate-100 bg-white shadow-[4px_0_24px_rgba(15,23,42,0.08)] transition-transform duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40 lg:hidden ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto p-5">
          <div className="mb-5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#2563eb]">Hypertension Buddy</p>
              <h2 className="mt-0.5 truncate text-lg font-semibold text-slate-900 dark:text-zinc-50">Menu</h2>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              aria-label="Close menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="space-y-2">
            {sections.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => {
                  setActiveSection(item);
                  setMobileNavOpen(false);
                }}
                className={`w-full rounded-[12px] px-4 py-3 text-left text-sm font-medium transition ${
                  activeSection === item
                    ? "bg-[#2563eb] text-white shadow-md"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="mt-6 rounded-[12px] border border-slate-100 bg-slate-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Signed in</p>
            <p className="mt-1 truncate text-sm font-medium text-slate-800 dark:text-zinc-100">{session.user.email}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{profile.name ? profile.name : "Name not set"}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMobileNavOpen(false);
              void handleLogout();
            }}
            className="mt-auto w-full rounded-[12px] border border-red-100 bg-red-50 px-4 py-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60"
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="mx-auto grid w-full max-w-7xl gap-5 p-4 sm:p-5 lg:grid-cols-[260px_1fr] lg:p-6">
        <aside className={`${shellCardClass} hidden h-fit p-5 lg:block`}>
          <div className="mb-6 rounded-[12px] bg-gradient-to-br from-[#2563eb] to-blue-600 p-4 text-white shadow-md">
            <p className="text-xs uppercase tracking-wide text-white/90">Hypertension Buddy</p>
            <h2 className="mt-1 text-lg font-semibold">Dashboard</h2>
          </div>
          <nav className="space-y-2">
            {sections.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setActiveSection(item)}
                className={`w-full rounded-[12px] px-4 py-3 text-left text-sm font-medium transition ${
                  activeSection === item
                    ? "bg-[#2563eb] text-white shadow-md"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="mt-6 rounded-[12px] border border-slate-100 bg-slate-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Signed in</p>
            <p className="mt-2 truncate text-sm font-medium text-slate-800 dark:text-zinc-100">{session.user.email}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Name: {profile.name || "Not set"}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="mt-6 w-full rounded-[12px] border border-red-100 bg-red-50 px-4 py-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60"
          >
            Logout
          </button>
        </aside>

        <main className="min-w-0 space-y-5 pb-8 lg:pb-0">
          {activeSection === "Dashboard" && renderDashboard()}
          {activeSection === "Profile" && renderProfile()}
          {activeSection === "History" && renderHistoryTable()}
          {activeSection === "Health Tips" && renderHealthTips()}
        </main>
      </div>

      {showAddReadingModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-900/50 px-4 py-6 dark:bg-black/60">
          <div
            className="relative mx-auto w-[90%] max-w-[400px] rounded-xl border border-slate-200/80 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-reading-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6 dark:border-zinc-800">
              <h2 id="add-reading-title" className="pr-2 text-lg font-semibold text-slate-900 dark:text-zinc-50">
                Enter Blood Pressure Reading
              </h2>
              <button
                type="button"
                onClick={closeAddReadingModal}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form className="p-6" onSubmit={(event) => void addReading(event)}>
              <div className={`${bpFormCardClass} space-y-4`}>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    Age
                  </label>
                  <div className="relative mt-1.5">
                    <User
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <input
                      value={readingAge}
                      onChange={(event) => {
                        setReadingAge(event.target.value);
                        setBpFormWarning("");
                      }}
                      type="number"
                      min={1}
                      placeholder="22"
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-neutral-900 caret-neutral-900 outline-none transition placeholder:text-gray-500 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 dark:border-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    Systolic
                  </label>
                  <div className="relative mt-1.5">
                    <Heart
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <input
                      value={systolic}
                      onChange={(event) => {
                        setSystolic(event.target.value);
                        setBpFormWarning("");
                      }}
                      type="number"
                      min={70}
                      placeholder="120"
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-neutral-900 caret-neutral-900 outline-none transition placeholder:text-gray-500 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 dark:border-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    Diastolic
                  </label>
                  <div className="relative mt-1.5">
                    <Activity
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <input
                      value={diastolic}
                      onChange={(event) => {
                        setDiastolic(event.target.value);
                        setBpFormWarning("");
                      }}
                      type="number"
                      min={40}
                      placeholder="80"
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-neutral-900 caret-neutral-900 outline-none transition placeholder:text-gray-500 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 dark:border-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                    />
                  </div>
                </div>
                {bpFormWarning ? (
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400" role="alert">
                    {bpFormWarning}
                  </p>
                ) : null}
                {saveError ? (
                  <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
                ) : null}
                <button type="submit" className={`${primaryBtnClass} w-full rounded-xl py-3.5`}>
                  Save Reading
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showResultModal && latestSubmitted ? (
        <div className="fixed inset-0 z-[65] flex items-center justify-center overflow-y-auto bg-slate-900/45 px-4 py-6 dark:bg-black/55">
          <div
            className={`mx-auto w-[90%] max-w-[400px] max-h-[min(85vh,640px)] overflow-y-auto rounded-[12px] bg-white shadow-2xl ring-2 ring-offset-2 ring-offset-white dark:bg-zinc-900 dark:ring-offset-zinc-950 ${categoryStyles[latestSubmitted.category].ring}`}
          >
            <div className={`p-6 pb-4 text-white ${modalHeaderClass[latestSubmitted.category]}`}>
              <p className="text-xs uppercase tracking-wide text-white/90">Hypertension Buddy · Classification</p>
              <h3 className="mt-1 text-xl font-semibold sm:text-2xl">{latestSubmitted.category}</h3>
              <p className="mt-1 text-sm text-white/90">{categoryStyles[latestSubmitted.category].note}</p>
            </div>
            <div
              className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/50 dark:text-emerald-300"
              style={{ animation: "success-toast-in 0.4s ease-out both" }}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
                style={{ animation: "success-check-pop 0.5s ease-out both" }}
                aria-hidden
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              Success! Your reading is saved securely.
            </div>
            <div className="space-y-4 p-6 pt-4">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-zinc-800/80">
                <p className="text-sm text-slate-600 dark:text-zinc-300">
                  Reading:{" "}
                  <span className="font-semibold text-slate-900 dark:text-zinc-50">
                    {latestSubmitted.systolic}/{latestSubmitted.diastolic} mmHg
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                  Age: <span className="font-semibold text-slate-900 dark:text-zinc-50">{latestSubmitted.age}</span>
                </p>
              </div>

              <div className="rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100 dark:bg-blue-950/30 dark:ring-blue-900/50">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Clinical guidance</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-zinc-300">
                  {clinicalAdvice[latestSubmitted.category].map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-zinc-800/60 dark:ring-zinc-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  Lifestyle plan
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-zinc-300">
                  {structuredTips.slice(0, 4).map((tip) => (
                    <li key={tip.title}>
                      <span className="font-semibold text-slate-800 dark:text-zinc-100">{tip.title}:</span>{" "}
                      {tip.points[0]}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/40 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Reading saved to Supabase</p>
                <button
                  type="button"
                  onClick={downloadPdfReport}
                  className="inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 sm:w-auto"
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
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
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
