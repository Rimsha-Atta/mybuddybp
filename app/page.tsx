"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { jsPDF } from "jspdf";
import type { Session } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
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
import {
  Activity,
  Apple,
  Ban,
  BookOpenText,
  Brain,
  Calendar,
  CalendarDays,
  Check,
  CigaretteOff,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Fingerprint,
  Heart,
  History,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Mail,
  Moon,
  Pill,
  Salad,
  Shield,
  Sun,
  User,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  name: string;
};

type BpCategory = "Normal" | "Elevated" | "Stage 1" | "Stage 2" | "Crisis";

type BpMetadata = {
  ahaCategory: BpCategory;
  appliedStandard: "AHA 2017" | "AHA 2017 + JNC-8/ACP age layer";
  ageRuleApplied: boolean;
  ageBasedNormalOverride: boolean;
  icd11Code: "BA00 (Essential Hypertension)";
  escPharmaConsideration: boolean;
  criticalAlert: boolean;
};

type Reading = {
  id: string;
  systolic: number;
  diastolic: number;
  /** Stored in Supabase `readings.age` column. */
  age: number;
  category: BpCategory;
  metadata: BpMetadata;
  createdAt: string;
};

type Section =
  | "Profile"
  | "Dashboard"
  | "History"
  | "Health Tips"
  | "Medical Standards";

const sidebarNavItems: {
  label: Exclude<Section, "Profile">;
  icon: typeof LayoutDashboard;
}[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "History", icon: History },
  { label: "Health Tips", icon: Lightbulb },
  { label: "Medical Standards", icon: BookOpenText },
];

function categorizeReading(systolic: number, diastolic: number): BpCategory {
  if (systolic >= 180 || diastolic >= 120) return "Crisis";
  if (systolic >= 140 || diastolic >= 90) return "Stage 2";
  if (
    (systolic >= 130 && systolic <= 139) ||
    (diastolic >= 80 && diastolic <= 89)
  ) {
    return "Stage 1";
  }
  if (systolic >= 120 && systolic <= 129 && diastolic < 80) return "Elevated";
  return "Normal";
}

function analyzeReading(
  systolic: number,
  diastolic: number,
  age: number,
): { category: BpCategory; metadata: BpMetadata } {
  const ahaCategory = categorizeReading(systolic, diastolic);
  const ageRuleApplied = age >= 60;
  const ageBasedNormalOverride =
    ageRuleApplied && systolic < 150 && diastolic < 90;
  const criticalAlert = systolic > 180 || diastolic > 120;
  const escPharmaConsideration = systolic > 140 || diastolic > 90;

  return {
    category: ageBasedNormalOverride ? "Normal" : ahaCategory,
    metadata: {
      ahaCategory,
      appliedStandard: ageRuleApplied
        ? "AHA 2017 + JNC-8/ACP age layer"
        : "AHA 2017",
      ageRuleApplied,
      ageBasedNormalOverride,
      icd11Code: "BA00 (Essential Hypertension)",
      escPharmaConsideration,
      criticalAlert,
    },
  };
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
    badge: "bg-red-700 text-white",
    text: "text-red-700",
    note: "Hypertension Crisis. Seek immediate medical attention.",
  },
};

const clinicalAdvice: Record<BpCategory, string[]> = {
  Normal: [
    "Continue balanced DASH-style meals with fruits, vegetables, and whole grains.",
    "Keep sodium intake below 5g of salt per day per WHO guidance.",
    "Maintain at least 150 minutes of moderate-intensity aerobic activity weekly.",
    "Recheck blood pressure weekly and continue healthy routines.",
  ],
  Elevated: [
    "Reduce sodium intake to less than 5g/day and avoid heavily processed foods.",
    "Exercise regularly with 150 minutes of moderate-intensity aerobic activity per week.",
    "Practice stress management daily and monitor blood pressure every few days.",
  ],
  "Stage 1": [
    "Follow DASH-focused, low-salt nutrition and increase fiber intake.",
    "Maintain 150 minutes/week of moderate-intensity aerobic activity and sleep hygiene.",
    "Use stress-reduction techniques such as breathing exercises or mindfulness.",
    "Consult your doctor if readings stay elevated consistently.",
  ],
  "Stage 2": [
    "Reduce sodium aggressively to under 5g/day and follow a DASH diet plan.",
    "Exercise at least 150 minutes/week, manage stress, and avoid tobacco and excess alcohol.",
    "Consult your physician promptly for treatment planning and close monitoring.",
  ],
  Crisis: [
    "Retake the reading after sitting calmly for 5 minutes.",
    "If still in crisis range, seek urgent emergency care immediately.",
    "Do not delay medical treatment if severe symptoms are present.",
  ],
};

const WHO_ICD11_TEXT = "WHO ICD-11 Code: BA00 (Essential Hypertension)";
const CRITICAL_ALERT_GUIDANCE =
  "Based on ACC/AHA 2021 ACS and ESC 2023 NSTEMI Guidelines, immediate clinical evaluation is required to rule out acute cardiac events.";
const ESC_PHARMA_NOTE =
  "Meets ESC 2023 Hypertension criteria for pharmacological consideration";

/** ACC/AHA-style reference ranges for patient education (PDF + UI context). */
const ahaJnc8ReferenceRows: {
  category: BpCategory;
  systolic: string;
  diastolic: string;
}[] = [
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
    icon: Salad,
    color: "bg-emerald-50 text-emerald-700 border-emerald-100",
    points: [
      "Focus on fruits, vegetables, whole grains, and lean proteins.",
      "Use low-fat dairy and avoid trans-fat-rich processed meals.",
    ],
  },
  {
    title: "Sodium Intake (<5g/day salt)",
    icon: Ban,
    color: "bg-amber-50 text-amber-700 border-amber-100",
    points: [
      "Follow WHO guidance: keep total salt intake below 5g/day.",
      "Replace added salt with herbs, lemon, and natural spices.",
    ],
  },
  {
    title: "Physical Activity (150 mins/week)",
    icon: Activity,
    color: "bg-blue-50 text-blue-700 border-blue-100",
    points: [
      "Target 30 minutes of moderate activity for 5 days weekly.",
      "Include walking, cycling, or swimming plus light strength work.",
    ],
  },
  {
    title: "Stress Management",
    icon: Brain,
    color: "bg-purple-50 text-purple-700 border-purple-100",
    points: [
      "Practice deep breathing or mindfulness 10-15 minutes daily.",
      "Use healthy coping strategies and reduce chronic stress triggers.",
    ],
  },
  {
    title: "Quality Sleep",
    icon: Moon,
    color: "bg-indigo-50 text-indigo-700 border-indigo-100",
    points: [
      "Aim for 7-9 hours of consistent sleep each night.",
      "Limit late caffeine and screen exposure before bedtime.",
    ],
  },
  {
    title: "Medication Adherence",
    icon: Pill,
    color: "bg-rose-50 text-rose-700 border-rose-100",
    points: [
      "Take prescribed medications exactly as directed by your doctor.",
      "Set reminders and never stop medication without medical advice.",
    ],
  },
  {
    title: "Limit Alcohol",
    icon: Zap,
    color: "bg-orange-50 text-orange-700 border-orange-100",
    points: [
      "Keep alcohol intake minimal and avoid binge drinking.",
      "Choose alcohol-free days each week to support BP control.",
    ],
  },
  {
    title: "Quit Smoking",
    icon: CigaretteOff,
    color: "bg-red-50 text-red-700 border-red-100",
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
  "rounded-xl bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md hover:-translate-y-0.5 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900";

const bpFormCardClass =
  "rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-[#252525]";

const medicalGuidelineReferences = [
  {
    title: "AHA/ACC 2017 Hypertension Guideline",
    summary:
      "Core blood pressure categorization used across all readings (Normal, Elevated, Stage 1, Stage 2, Crisis).",
    citation:
      "Whelton PK, et al. 2017 ACC/AHA Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure in Adults.",
  },
  {
    title: "JNC-8 / ACP Age-Based Layer",
    summary:
      "For age 60+, an additional layer recognizes systolic values below 150 mmHg with diastolic below 90 mmHg as age-adjusted normal context.",
    citation:
      "James PA, et al. JAMA 2014 (JNC-8) and ACP/AAFP guidance for older adults.",
  },
  {
    title: "ACC/AHA ACS 2021 + ESC NSTEMI 2023",
    summary:
      "Readings above 180/120 trigger a Critical Alert to prioritize emergency assessment for possible acute cardiac events.",
    citation:
      "2021 AHA/ACC Chest Pain and ACS-focused updates; 2023 ESC Acute Coronary Syndromes guideline.",
  },
  {
    title: "ESC 2023 Hypertension Context",
    summary:
      "Readings above 140/90 include a secondary note indicating ESC pharmacological consideration threshold.",
    citation:
      "2023 ESC Guidelines for the management of arterial hypertension.",
  },
  {
    title: "WHO ICD-11",
    summary:
      "All results append ICD-11 coding metadata for essential hypertension documentation.",
    citation: "WHO ICD-11: BA00 Essential Hypertension.",
  },
];

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

function formatDateTimeLocal(d: string | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

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

function isBpMetadata(value: unknown): value is BpMetadata {
  if (!value || typeof value !== "object") return false;
  const metadata = value as Partial<BpMetadata>;
  return (
    typeof metadata.ahaCategory === "string" &&
    typeof metadata.appliedStandard === "string" &&
    typeof metadata.ageRuleApplied === "boolean" &&
    typeof metadata.ageBasedNormalOverride === "boolean" &&
    typeof metadata.icd11Code === "string" &&
    typeof metadata.escPharmaConsideration === "boolean" &&
    typeof metadata.criticalAlert === "boolean"
  );
}

function getReadingGuidance(reading: Reading): string[] {
  const guidance = [...clinicalAdvice[reading.category]];
  if (reading.metadata.ageBasedNormalOverride) {
    guidance.push(
      "Age-adjusted layer applied (JNC-8/ACP context): systolic under 150 mmHg and diastolic under 90 mmHg.",
    );
  }
  if (reading.metadata.escPharmaConsideration) guidance.push(ESC_PHARMA_NOTE);
  guidance.push(WHO_ICD11_TEXT);
  return guidance;
}

export default function Home() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>(() =>
    pathname === "/profile" ? "Profile" : "Dashboard",
  );
  const [profile, setProfile] = useState<Profile>(() => {
    if (typeof window === "undefined") return { name: "" };
    try {
      return {
        name: window.localStorage.getItem("hb-profile-name:last") ?? "",
      };
    } catch {
      return { name: "" };
    }
  });
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
  const [idCopied, setIdCopied] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const darkMode = resolvedTheme === "dark";
  const profileName = profile.name.trim();
  const profileDisplayLabel = profileName || session?.user?.email || "User";

  useEffect(() => {
    setActiveSection(pathname === "/profile" ? "Profile" : "Dashboard");
  }, [pathname]);

  useEffect(() => {
    if (!session?.user) {
      return;
    }
    try {
      const key = `hb-profile-name:${session.user.id}`;
      const savedName = window.localStorage.getItem(key);
      if (savedName != null) {
        setProfile({ name: savedName });
      }
    } catch {
      // Ignore storage failures (e.g., private mode restrictions).
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user) return;
    try {
      const key = `hb-profile-name:${session.user.id}`;
      window.localStorage.setItem(key, profile.name);
      window.localStorage.setItem("hb-profile-name:last", profile.name);
    } catch {
      // Ignore storage failures to avoid blocking profile editing.
    }
  }, [profile.name, session?.user?.id]);

  const handleSectionNavigation = (section: Section) => {
    setActiveSection(section);
    if (section === "Profile") {
      router.push("/profile");
      return;
    }
    if (pathname === "/profile") {
      router.push("/");
    }
  };

  const fetchReadings = async (userId: string) => {
    let data:
      | {
          id: string;
          systolic: number;
          diastolic: number;
          age: number;
          created_at: string;
          metadata?: unknown;
        }[]
      | null = null;
    let error: { message: string } | null = null;

    const withMetadata = await supabase
      .from("readings")
      .select("id, systolic, diastolic, age, created_at, metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (withMetadata.error?.message?.toLowerCase().includes("metadata")) {
      const fallback = await supabase
        .from("readings")
        .select("id, systolic, diastolic, age, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      data = fallback.data;
      error = fallback.error;
    } else {
      data = withMetadata.data;
      error = withMetadata.error;
    }

    if (error) {
      setFetchError(error.message);
      return;
    }

    setFetchError("");
    setReadings(
      (data ?? []).map((row) => {
        const analysis = analyzeReading(row.systolic, row.diastolic, row.age);
        return {
          ...analysis,
          id: row.id,
          systolic: row.systolic,
          diastolic: row.diastolic,
          age: row.age,
          metadata: isBpMetadata(row.metadata)
            ? row.metadata
            : analysis.metadata,
          createdAt: row.created_at,
        };
      }),
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

  const fallbackReadingAnalysis = analyzeReading(119, 79, 59);
  const latestReading = readings[0];
  const latestCategory =
    latestReading?.category ?? fallbackReadingAnalysis.category;
  const displayName = profileDisplayLabel;

  const chartData = useMemo(
    () =>
      [...readings].reverse().map((reading) => ({
        time: new Date(reading.createdAt).toLocaleDateString([], {
          month: "short",
          day: "numeric",
        }),
        systolic: reading.systolic,
        diastolic: reading.diastolic,
      })),
    [readings],
  );

  const downloadClinicalReport = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = margin;

    const sectionTitle = (title: string) => {
      y += 10;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(title.toUpperCase(), margin, y);
      y += 2;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(margin, y, margin + contentW, y);
      y += 8;
    };

    // Header Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.text("Hypertension Buddy", margin, y);
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text("Clinical Report", margin, y + 7);

    // Patient Info (Top Right)
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    const rightAlignX = margin + contentW;
    doc.text(`Patient: ${displayName}`, rightAlignX, y, { align: "right" });
    y += 5;
    const ageForReport = latestReading?.age;
    doc.text(
      `Age: ${ageForReport != null ? ageForReport : "—"}`,
      rightAlignX,
      y,
      { align: "right" },
    );
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, rightAlignX, y, {
      align: "right",
    });
    y += 15;

    // Clinical Status Summary
    sectionTitle("Clinical Status Summary");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Latest Reading:", margin, y);
    doc.setFont("helvetica", "normal");
    if (latestReading) {
      doc.text(
        `${latestReading.systolic}/${latestReading.diastolic} mmHg`,
        margin + 40,
        y,
      );
    } else {
      doc.text("No readings recorded", margin + 40, y);
    }
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.text("Classification:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(
      latestReading
        ? `${latestCategory} (${latestReading.metadata.appliedStandard})`
        : latestCategory,
      margin + 40,
      y,
    );
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text("WHO ICD-11:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(WHO_ICD11_TEXT.replace("WHO ICD-11 Code: ", ""), margin + 40, y);
    y += 12;

    // Medical Standards Reference Table
    sectionTitle("Medical Standards Reference");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(250, 250, 250);
    doc.rect(margin, y - 5, contentW, 7, "F");
    doc.text("Category", margin + 5, y);
    doc.text("Systolic Range", margin + 65, y);
    doc.text("Diastolic Range", margin + 125, y);
    y += 2;

    doc.setFont("helvetica", "normal");
    doc.setDrawColor(230, 230, 230);
    for (const row of ahaJnc8ReferenceRows) {
      y += 8;
      doc.line(margin, y - 5, margin + contentW, y - 5);
      doc.text(row.category, margin + 5, y);
      doc.text(row.systolic, margin + 65, y);
      doc.text(row.diastolic, margin + 125, y);
    }
    doc.line(margin, y + 3, margin + contentW, y + 3);
    y += 15;

    // Recommendations
    sectionTitle("Clinical Guidance");
    doc.setFontSize(10);
    const recLines: string[] = latestReading
      ? getReadingGuidance(latestReading)
      : [...clinicalAdvice[latestCategory], WHO_ICD11_TEXT];
    for (const line of recLines) {
      const wrapped = doc.splitTextToSize(`• ${line}`, contentW - 5);
      for (const wline of wrapped) {
        doc.text(wline, margin + 2, y);
        y += 6;
      }
    }

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.text(
      "Generated using AHA 2017, JNC-8/ACP, ACC/AHA ACS 2021, ESC NSTEMI 2023, ESC 2023 HTN context, and WHO ICD-11 (BA00).",
      pageW / 2,
      footerY,
      { align: "center" },
    );

    doc.save(
      `hypertension-buddy-clinical-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  const downloadHistoryPdfReport = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentW = pageW - margin * 2;
    let y = margin;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageH - margin) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    };

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Hypertension Buddy - Patient History Report", margin, y);
    y += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Patient: ${displayName}`, margin, y);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - margin, y, {
      align: "right",
    });
    y += 10;

    // Table Header
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 5, contentW, 8, "F");
    doc.text("Date & Time", margin + 2, y);
    doc.text("Systolic", margin + 60, y);
    doc.text("Diastolic", margin + 85, y);
    doc.text("Age", margin + 110, y);
    doc.text("Medical Category", margin + 130, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.1);

    for (const reading of readings) {
      ensureSpace(10);
      const dateStr = new Date(reading.createdAt).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      });
      doc.text(dateStr, margin + 2, y);
      doc.text(String(reading.systolic), margin + 60, y);
      doc.text(String(reading.diastolic), margin + 85, y);
      doc.text(String(reading.age), margin + 110, y);
      doc.text(reading.category, margin + 130, y);
      doc.line(margin, y + 3, margin + contentW, y + 3);
      y += 8;
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `History Report | Page ${i} of ${pageCount} | Medical Standards Applied`,
        pageW / 2,
        pageH - 10,
        { align: "center" },
      );
    }

    doc.save(
      `hypertension-buddy-history-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  const addReading = async (event: FormEvent) => {
    event.preventDefault();
    if (!session?.user) return;

    const ageStr = readingAge.trim();
    const sysStr = systolic.trim();
    const diaStr = diastolic.trim();
    if (!ageStr || !sysStr || !diaStr) {
      setBpFormWarning(
        "Please fill in Age, Systolic, and Diastolic before submitting.",
      );
      setSaveError("");
      return;
    }

    const sys = Number(sysStr);
    const dia = Number(diaStr);
    const age = Number(ageStr);
    if (
      !Number.isFinite(sys) ||
      !Number.isFinite(dia) ||
      !Number.isFinite(age)
    ) {
      setBpFormWarning("Please enter valid numbers for all fields.");
      return;
    }
    if (sys < 70 || dia < 40 || age < 1) {
      setBpFormWarning(
        "Check your values: age ≥ 1, systolic ≥ 70, diastolic ≥ 40.",
      );
      return;
    }

    setBpFormWarning("");
    setSaveError("");
    const analysis = analyzeReading(sys, dia, age);

    let data: {
      id: string;
      systolic: number;
      diastolic: number;
      age: number;
      created_at: string;
      metadata?: unknown;
    } | null = null;
    let error: { message: string } | null = null;

    const withMetadata = await supabase
      .from("readings")
      .insert({
        user_id: session.user.id,
        systolic: sys,
        diastolic: dia,
        age: age,
        metadata: analysis.metadata,
      })
      .select("id, systolic, diastolic, age, created_at, metadata")
      .single();

    if (withMetadata.error?.message?.toLowerCase().includes("metadata")) {
      const fallback = await supabase
        .from("readings")
        .insert({
          user_id: session.user.id,
          systolic: sys,
          diastolic: dia,
          age: age,
        })
        .select("id, systolic, diastolic, age, created_at")
        .single();
      data = fallback.data;
      error = fallback.error;
    } else {
      data = withMetadata.data;
      error = withMetadata.error;
    }

    if (error || !data) {
      setSaveError(error?.message ?? "Could not save reading.");
      return;
    }

    const entry: Reading = {
      id: data.id,
      systolic: data.systolic,
      diastolic: data.diastolic,
      age: data.age,
      category: analysis.category,
      metadata: isBpMetadata(data.metadata) ? data.metadata : analysis.metadata,
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
    const { error } = await supabase
      .from("readings")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id);
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
      setAuthMessage(
        "Signup successful. Check your email to confirm your account.",
      );
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
    const initials = "RI"; // Fixed initials as requested
    const profileHeadlineName = profile.name.trim() || email;
    const accountCreated = formatDateTimeLocal(u?.created_at);
    const lastSignIn = formatDateTimeLocal(u?.last_sign_in_at);

    return (
      <div className='mx-auto max-w-4xl space-y-8 pb-12 pt-16'>
        {/* Modern SaaS Header */}
        <div className='flex flex-col gap-6 md:flex-row md:items-center md:justify-between'>
          <div className='flex items-center gap-5'>
            <div className='flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 p-1 shadow-lg ring-4 ring-white dark:ring-zinc-900'>
              <div className='flex h-full w-full items-center justify-center rounded-full bg-white/10 text-2xl font-bold text-white backdrop-blur-md'>
                {initials}
              </div>
            </div>
            <div>
              <div className='flex items-center gap-3'>
                <h1 className='text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50'>
                  {profileHeadlineName}
                </h1>
                <span className='inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800'>
                  Active Patient
                </span>
              </div>
              <p className='mt-1 text-sm font-medium text-slate-500 dark:text-zinc-400'>
                {email}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Settings Card */}
        <section className='overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none'>
          <div className='p-8'>
            <div className='max-w-xl'>
              <label className='flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400'>
                <User className='h-3.5 w-3.5' />
                Display Name (for reports)
              </label>
              <div className='group relative mt-3'>
                <input
                  value={profile.name}
                  onChange={(event) =>
                    setProfile((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className='w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-4 text-slate-900 transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:hover:border-zinc-700 dark:focus:border-blue-400 dark:focus:bg-zinc-800 dark:focus:ring-blue-400/10'
                  placeholder='Enter your full name'
                />
              </div>
              <p className='mt-3 text-[11px] font-medium text-slate-400 dark:text-zinc-500'>
                This name will be used across all your clinical and history
                reports.
              </p>

              <button
                type='button'
                onClick={() => setSaveSuccessToast(true)}
                className='mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95 md:w-auto'
              >
                Save Changes
              </button>
            </div>
          </div>
        </section>

        {/* Interactive Info Cards */}
        <div className='grid gap-4 md:grid-cols-3'>
          <div className='group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-900'>
            <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'>
              <Mail className='h-6 w-6' />
            </div>
            <p className='mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500'>
              Account Email
            </p>
            <p className='mt-1 truncate text-sm font-bold text-slate-900 dark:text-zinc-50'>
              {email}
            </p>
          </div>

          <div className='group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-900'>
            <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'>
              <CalendarDays className='h-6 w-6' />
            </div>
            <p className='mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500'>
              Joined Date
            </p>
            <p className='mt-1 text-sm font-bold text-slate-900 dark:text-zinc-50'>
              {accountCreated}
            </p>
          </div>

          <div className='group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-900'>
            <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'>
              <Fingerprint className='h-6 w-6' />
            </div>
            <p className='mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500'>
              Patient ID
            </p>
            <div className='mt-1 flex items-center gap-2'>
              <p className='truncate font-mono text-[10px] font-bold text-slate-600 dark:text-zinc-400'>
                {u?.id ? `${u.id.slice(0, 5)}...${u.id.slice(-5)}` : "—"}
              </p>
              {u?.id && (
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(u.id);
                    setIdCopied(true);
                    setTimeout(() => setIdCopied(false), 2000);
                  }}
                  className='flex h-6 w-6 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-blue-400'
                  title='Copy full ID'
                >
                  {idCopied ? (
                    <Check className='h-3 w-3 text-emerald-500' />
                  ) : (
                    <Copy className='h-3 w-3' />
                  )}
                </button>
              )}
            </div>
            {idCopied && (
              <span className='absolute mt-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-bottom-1'>
                Copied!
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryTable = () => (
    <section
      className={`${shellCardClass} p-8 shadow-xl shadow-slate-200/50 dark:shadow-none`}
    >
      <div className='mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h2 className='text-2xl font-bold text-slate-900 dark:text-zinc-50'>
            Reading History
          </h2>
          <p className='text-sm text-slate-500 dark:text-zinc-400'>
            Detailed log of your {readings.length} previous measurements
          </p>
        </div>
        <button
          type='button'
          onClick={downloadHistoryPdfReport}
          className={`${primaryBtnClass} w-full sm:w-auto shadow-lg shadow-blue-500/10`}
        >
          Download Full Report
        </button>
      </div>
      <div className='mt-6 overflow-hidden rounded-2xl border border-slate-100 dark:border-zinc-800'>
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[680px] text-left text-sm'>
            <thead>
              <tr className='bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-zinc-800/50 dark:text-zinc-400'>
                <th className='px-6 py-4'>Timestamp</th>
                <th className='px-6 py-4'>Systolic</th>
                <th className='px-6 py-4'>Diastolic</th>
                <th className='px-6 py-4'>Age</th>
                <th className='px-6 py-4'>Category</th>
                <th className='px-6 py-4 text-center'>Actions</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100 dark:divide-zinc-800'>
              {readings.map((reading) => (
                <tr
                  key={reading.id}
                  className='group transition-colors hover:bg-slate-50/50 dark:hover:bg-zinc-800/30'
                >
                  <td className='whitespace-nowrap px-6 py-4 font-medium text-slate-600 dark:text-zinc-300'>
                    {new Date(reading.createdAt).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className='px-6 py-4'>
                    <span className='rounded-lg bg-blue-50 px-3 py-1 font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'>
                      {reading.systolic}
                    </span>
                  </td>
                  <td className='px-6 py-4'>
                    <span className='rounded-lg bg-orange-50 px-3 py-1 font-bold text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'>
                      {reading.diastolic}
                    </span>
                  </td>
                  <td className='px-6 py-4 font-medium text-slate-700 dark:text-zinc-300'>
                    {reading.age}
                  </td>
                  <td className='px-6 py-4'>
                    <div className='space-y-1'>
                      <span
                        className={`inline-flex rounded-xl px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${categoryStyles[reading.category].badge}`}
                      >
                        {reading.category}
                      </span>
                      <p className='text-[10px] font-medium text-slate-500 dark:text-zinc-400'>
                        WHO ICD-11: {reading.metadata.icd11Code}
                      </p>
                      {reading.metadata.criticalAlert ? (
                        <p className='text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400'>
                          Critical Alert
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className='px-6 py-4 text-center'>
                    <button
                      type='button'
                      onClick={() => deleteReading(reading.id)}
                      className='inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 opacity-0 transition-all hover:bg-red-100 hover:text-red-700 group-hover:opacity-100 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-950/70'
                      aria-label='Delete reading'
                    >
                      <svg
                        viewBox='0 0 24 24'
                        fill='currentColor'
                        className='h-4 w-4'
                      >
                        <path d='M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z' />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {readings.length === 0 ? (
        <div className='mt-8 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-zinc-800'>
          <p className='text-sm font-medium text-slate-500 dark:text-zinc-400'>
            No medical records found. Start by adding your first reading.
          </p>
        </div>
      ) : null}
      {fetchError ? (
        <div className='mt-4 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400'>
          Error loading history: {fetchError}
        </div>
      ) : null}
    </section>
  );

  const renderHealthTips = () => (
    <section className={`${shellCardClass} p-6 sm:p-8`}>
      <h2 className='text-xl font-semibold text-slate-900 dark:text-zinc-50'>
        Health Tips
      </h2>
      <p className='mt-1 text-sm text-slate-500 dark:text-zinc-400'>
        Structured prevention plan for status:{" "}
        <span
          className={`font-semibold ${categoryStyles[latestCategory].text}`}
        >
          {latestCategory}
        </span>
      </p>
      <div className='mt-6 grid gap-4 md:grid-cols-2'>
        {structuredTips.map((tip) => (
          <article
            key={tip.title}
            className={`rounded-2xl border p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-1 ${tip.color} dark:bg-opacity-10 dark:border-opacity-20`}
          >
            <div className='flex items-center gap-3'>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-sm dark:bg-zinc-800`}
              >
                <tip.icon className='h-5 w-5' strokeWidth={2.5} />
              </div>
              <h3 className='text-sm font-bold uppercase tracking-wide'>
                {tip.title}
              </h3>
            </div>
            <ul className='mt-4 space-y-2 text-sm opacity-90'>
              {tip.points.map((point) => (
                <li key={point} className='flex items-start gap-2'>
                  <span className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60' />
                  {point}
                </li>
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

  const renderMedicalStandards = () => (
    <div className='space-y-10'>
      <div className='text-center sm:text-left'>
        <p className='text-xs font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-widest'>
          Layered Clinical Intelligence: AHA 2017 + JNC-8/ACP + ESC + ACC/AHA
          ACS + WHO ICD-11
        </p>
      </div>

      <section className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5'>
        {(
          ["Normal", "Elevated", "Stage 1", "Stage 2", "Crisis"] as BpCategory[]
        ).map((category) => (
          <div
            key={category}
            className={`${dataCardClass} flex flex-col justify-between transition-all duration-300 hover:-translate-y-1`}
          >
            <div>
              <div
                className={`inline-flex rounded-xl px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${categoryStyles[category].badge}`}
              >
                {category}
              </div>
              <p className='mt-4 text-sm font-medium leading-relaxed text-slate-600 dark:text-zinc-300'>
                {categoryStyles[category].note}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section className={`${shellCardClass} p-8 overflow-hidden`}>
        <h2 className='text-xl font-bold text-slate-900 dark:text-zinc-50 mb-6'>
          Standard Reference Ranges
        </h2>
        <div className='overflow-x-auto rounded-2xl border border-slate-100 dark:border-zinc-800'>
          <table className='w-full text-left text-sm'>
            <thead>
              <tr className='bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-zinc-800/50 dark:text-zinc-400'>
                <th className='px-6 py-4'>Category</th>
                <th className='px-6 py-4'>Systolic (mmHg)</th>
                <th className='px-6 py-4'>Diastolic (mmHg)</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100 dark:divide-zinc-800'>
              {ahaJnc8ReferenceRows.map((row) => (
                <tr
                  key={row.category}
                  className='hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors'
                >
                  <td className='px-6 py-4 font-bold text-slate-900 dark:text-zinc-100'>
                    {row.category}
                  </td>
                  <td className='px-6 py-4 text-slate-600 dark:text-zinc-300'>
                    {row.systolic}
                  </td>
                  <td className='px-6 py-4 text-slate-600 dark:text-zinc-300'>
                    {row.diastolic}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className='mt-3 text-xs text-slate-500 dark:text-zinc-400'>
          Age-based layer: for adults aged 60+, systolic below 150 mmHg with
          diastolic below 90 mmHg is shown with age-adjusted normal context
          (JNC-8/ACP), while AHA 2017 classification remains tracked.
        </p>
      </section>

      <section className={`${shellCardClass} p-8`}>
        <h2 className='text-xl font-bold text-slate-900 dark:text-zinc-50'>
          Integrated Medical Standards
        </h2>
        <p className='mt-2 text-sm text-slate-500 dark:text-zinc-400'>
          These citations describe how the app now combines classification,
          emergency triage, regional context, and coding metadata in one result
          flow.
        </p>
        <div className='mt-6 grid gap-4 md:grid-cols-2'>
          {medicalGuidelineReferences.map((item) => (
            <article
              key={item.title}
              className='rounded-2xl border border-slate-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900'
            >
              <h3 className='text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-zinc-100'>
                {item.title}
              </h3>
              <p className='mt-2 text-sm text-slate-600 dark:text-zinc-300'>
                {item.summary}
              </p>
              <p className='mt-3 text-xs text-slate-500 dark:text-zinc-400'>
                Citation: {item.citation}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );

  const renderDashboard = () => {
    return (
      <div className='space-y-10 pt-3 md:pt-6'>
        <section className='mt-2 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5'>
          {(
            [
              "Normal",
              "Elevated",
              "Stage 1",
              "Stage 2",
              "Crisis",
            ] as BpCategory[]
          ).map((category) => (
            <div
              key={category}
              className={`${dataCardClass} ${
                latestCategory === category
                  ? `ring-4 ring-blue-500/20 ring-offset-2 ring-offset-slate-50 dark:ring-offset-zinc-950 ${categoryStyles[category].ring}`
                  : ""
              } flex flex-col justify-between transition-all duration-300 hover:-translate-y-1`}
            >
              <div>
                <div
                  className={`inline-flex rounded-xl px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${categoryStyles[category].badge}`}
                >
                  {category}
                </div>
                <p className='mt-4 text-sm font-medium leading-relaxed text-slate-600 dark:text-zinc-300'>
                  {categoryStyles[category].note}
                </p>
              </div>
            </div>
          ))}
        </section>

        <div className='mt-4 flex items-center justify-between gap-4'>
          <div>
            <h2 className='text-2xl font-bold text-slate-900 dark:text-zinc-50'>
              Health Dashboard
            </h2>
            <p className='text-sm text-slate-500 dark:text-zinc-400'>
              Welcome back to your personalized health tracking
            </p>
          </div>
          <button
            type='button'
            onClick={() => {
              setSaveError("");
              setBpFormWarning("");
              setShowAddReadingModal(true);
            }}
            className={`${primaryBtnClass} shadow-lg shadow-blue-500/20`}
          >
            + Add New Reading
          </button>
        </div>

        <section
          className={`${shellCardClass} p-8 shadow-xl shadow-slate-200/50 dark:shadow-none`}
        >
          <div className='mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h2 className='text-xl font-bold text-slate-900 dark:text-zinc-50'>
                Blood Pressure Trends
              </h2>
              <p className='text-sm text-slate-500 dark:text-zinc-400'>
                Monitoring your systolic and diastolic progress
              </p>
            </div>
          </div>
          <div className='mt-4 rounded-2xl border border-slate-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/80 sm:p-6'>
            <div className='h-72 w-full min-w-0'>
              <ResponsiveContainer width='100%' height='100%'>
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 10, left: 0, bottom: 6 }}
                >
                  <CartesianGrid
                    strokeDasharray='3 3'
                    stroke='var(--chart-grid)'
                  />
                  <XAxis
                    dataKey='time'
                    tick={{ fontSize: 12, fill: "var(--chart-axis)" }}
                  />
                  <YAxis
                    domain={[40, 200]}
                    tick={{ fontSize: 12, fill: "var(--chart-axis)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--chart-tooltip-bg)",
                      border: "1px solid var(--chart-tooltip-border)",
                      borderRadius: 12,
                      color: "var(--chart-tooltip-text)",
                    }}
                  />
                  <Legend wrapperStyle={{ color: "var(--chart-axis)" }} />
                  <Line
                    type='linear'
                    dataKey='systolic'
                    stroke='#2563eb'
                    strokeWidth={3}
                    dot
                  />
                  <Line
                    type='linear'
                    dataKey='diastolic'
                    stroke='#f97316'
                    strokeWidth={3}
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>
    );
  };

  if (authLoading)
    return <div className='min-h-screen bg-slate-50 dark:bg-zinc-950' />;

  const themeToggle = mounted ? (
    <button
      type='button'
      onClick={() => setTheme(darkMode ? "light" : "dark")}
      className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700'
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {darkMode ? (
        <Sun className='h-5 w-5' strokeWidth={2} />
      ) : (
        <Moon className='h-5 w-5' strokeWidth={2} />
      )}
    </button>
  ) : (
    <div className='h-11 w-11 shrink-0' />
  );

  if (!session?.user) {
    return (
      <div className='relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/80 px-4 py-6 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 sm:px-6'>
        <div className='fixed right-4 top-[max(12px,env(safe-area-inset-top,0px))] z-50 sm:right-5 sm:top-5'>
          {themeToggle}
        </div>
        <div
          className={`mx-auto w-[90%] max-w-md ${shellCardClass} p-6 sm:p-8`}
        >
          <div className='mb-6 flex flex-col items-center text-center'>
            <div className='flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#2563eb] text-white shadow-md'>
              <svg
                viewBox='0 0 24 24'
                fill='currentColor'
                className='h-5 w-5'
                aria-hidden='true'
              >
                <path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A4.5 4.5 0 0 1 6.5 4c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 12 7.15a6 6 0 0 1 1-1.06A5.93 5.93 0 0 1 17.5 4 4.5 4.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54z' />
              </svg>
            </div>
            <p className='mt-3 text-sm font-medium text-[#2563eb] dark:text-blue-400'>
              Hypertension Buddy
            </p>
            <h1 className='mt-1 text-xl font-semibold text-slate-900 dark:text-zinc-50'>
              Professional Login
            </h1>
          </div>
          <form
            onSubmit={(event) => void handleLogin(event)}
            className='mx-auto flex w-full max-w-full flex-col items-stretch space-y-3'
          >
            <input
              type='email'
              autoComplete='email'
              inputMode='email'
              value={loginEmail}
              onChange={(event) => {
                setLoginEmail(event.target.value);
                if (authMessage === INVALID_EMAIL_MSG) setAuthMessage("");
              }}
              placeholder='Email'
              className='login-email-input w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-gray-500 caret-neutral-900 outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500'
              required
            />
            <div className='relative isolate'>
              <input
                type={showLoginPassword ? "text" : "password"}
                autoComplete='current-password'
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder='Password'
                className='login-password-input w-full rounded-[12px] border border-slate-200 bg-white py-3 pl-4 pr-12 text-sm text-neutral-900 placeholder:text-gray-500 caret-neutral-900 outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500'
                required
              />
              <button
                type='button'
                onClick={(e) => {
                  e.preventDefault();
                  setShowLoginPassword((v) => !v);
                }}
                className='absolute right-1.5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 shrink-0 items-center justify-center rounded-lg text-gray-700 transition hover:bg-slate-100 hover:text-gray-900 active:scale-95 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white'
                aria-label={
                  showLoginPassword ? "Hide password" : "Show password"
                }
                aria-pressed={showLoginPassword}
              >
                {showLoginPassword ? (
                  <EyeOff
                    className='pointer-events-none h-5 w-5 shrink-0'
                    strokeWidth={2}
                  />
                ) : (
                  <Eye
                    className='pointer-events-none h-5 w-5 shrink-0'
                    strokeWidth={2}
                  />
                )}
              </button>
            </div>
            <button
              type='submit'
              className={`${primaryBtnClass} mx-auto w-full max-w-full`}
            >
              {authMode === "login" ? "Login" : "Create account"}
            </button>
            <button
              type='button'
              className='mx-auto w-full max-w-full rounded-[12px] bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-200 hover:shadow-md hover:-translate-y-0.5 active:scale-95 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
              onClick={() => {
                setAuthMode((prev) => (prev === "login" ? "signup" : "login"));
                setAuthMessage("");
                setShowLoginPassword(false);
              }}
            >
              {authMode === "login"
                ? "Need an account? Sign up"
                : "Already have an account? Login"}
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
    <div className='min-h-screen bg-slate-50 text-slate-800 dark:bg-zinc-950 dark:text-zinc-100'>
      {saveSuccessToast ? (
        <div
          className='fixed left-1/2 top-6 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-emerald-200 bg-white/95 px-5 py-4 text-sm font-bold text-emerald-900 shadow-[0_10px_40px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/10 backdrop-blur-md dark:border-emerald-800 dark:bg-zinc-900/95 dark:text-emerald-300'
          style={{
            animation:
              "success-toast-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both",
          }}
          role='status'
          aria-live='polite'
        >
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'>
            <svg
              className='h-5 w-5'
              fill='none'
              stroke='currentColor'
              strokeWidth={3}
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M5 13l4 4L19 7'
              />
            </svg>
          </div>
          <span className='whitespace-nowrap'>
            Success! Your reading has been saved.
          </span>
        </div>
      ) : null}

      <header className='sticky top-0 z-[90] flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95 lg:hidden'>
        <button
          type='button'
          onClick={() => setMobileNavOpen(true)}
          className='flex h-11 w-11 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
          aria-label='Open menu'
        >
          <svg
            className='h-6 w-6'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
            aria-hidden
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M4 6h16M4 12h16M4 18h16'
            />
          </svg>
        </button>
        <div className='flex items-center gap-2 truncate'>
          <Heart className='h-4 w-4 text-red-500 fill-red-500' />
          <span className='truncate text-sm font-semibold text-slate-900 dark:text-zinc-50'>
            Hypertension Buddy
          </span>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          {themeToggle}
          <button
            type='button'
            onClick={() => handleSectionNavigation("Profile")}
            className='flex h-11 w-11 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700'
            aria-label='Open profile'
          >
            <User className='h-5 w-5' strokeWidth={2.2} />
          </button>
        </div>
      </header>

      {mobileNavOpen ? (
        <button
          type='button'
          className='fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden'
          aria-label='Close menu'
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[min(300px,88vw)] transform border-r border-blue-900/40 bg-slate-900/95 text-slate-100 shadow-[6px_0_30px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-transform duration-200 ease-out lg:hidden ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className='flex h-full flex-col overflow-y-auto p-5'>
          <div className='mb-5 flex items-center justify-between gap-2'>
            <div className='min-w-0'>
              <p className='text-xs font-semibold uppercase tracking-wide text-blue-300'>
                Hypertension Buddy
              </p>
              <h2 className='mt-0.5 truncate text-lg font-semibold tracking-wide text-slate-100'>
                Menu
              </h2>
            </div>
            <button
              type='button'
              onClick={() => setMobileNavOpen(false)}
              className='flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-slate-700 text-slate-200 hover:bg-slate-800'
              aria-label='Close menu'
            >
              <svg
                className='h-5 w-5'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
                aria-hidden
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          </div>
          <nav className='space-y-3'>
            {sidebarNavItems.map((item) => (
              <button
                type='button'
                key={item.label}
                onClick={() => {
                  handleSectionNavigation(item.label);
                  setMobileNavOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-full px-5 py-3.5 text-left text-[15px] font-semibold transition-all duration-200 active:scale-95 ${
                  activeSection === item.label
                    ? "bg-blue-500/90 text-white shadow-lg shadow-blue-900/30"
                    : "bg-slate-800/80 text-slate-100 hover:bg-slate-700"
                }`}
              >
                <item.icon className='h-5 w-5 shrink-0' strokeWidth={2.3} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className='mt-6 rounded-2xl border border-slate-700 bg-slate-800/80 p-4'>
            <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>
              Signed in
            </p>
            <p className='mt-1 truncate text-sm font-medium text-slate-100'>
              {session.user.email}
            </p>
            <p className='mt-1 text-xs text-slate-400'>
              {profile.name ? profile.name : "Name not set"}
            </p>
          </div>
          <div className='mt-auto pt-8'>
            <button
              type='button'
              onClick={() => {
                setMobileNavOpen(false);
                void handleLogout();
              }}
              className='flex w-full items-center gap-3 rounded-full border border-red-400/30 bg-red-500/20 px-5 py-3.5 text-left text-[15px] font-semibold text-red-200 shadow-sm transition-all duration-200 hover:bg-red-500/30 hover:shadow-md hover:-translate-y-0.5 active:scale-95'
            >
              <LogOut className='h-5 w-5 shrink-0' strokeWidth={2.4} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className='mx-auto grid w-full max-w-7xl gap-8 p-4 sm:p-8 lg:grid-cols-[280px_1fr] lg:p-10'>
        <aside className='sticky top-[28px] hidden h-[calc(100vh-56px)] rounded-3xl border border-blue-900/40 bg-gradient-to-b from-slate-900 via-slate-900 to-blue-950 p-7 text-slate-100 shadow-2xl shadow-slate-900/40 lg:block'>
          <div className='mb-8 flex items-center gap-3 rounded-2xl bg-blue-500/15 p-5 ring-1 ring-blue-400/30'>
            <Heart className='h-6 w-6 text-white fill-white' />
            <h2 className='text-lg font-bold tracking-wide'>
              HYPERTENSION BUDDY
            </h2>
          </div>
          <nav className='space-y-3'>
            {sidebarNavItems.map((item) => (
              <button
                type='button'
                key={item.label}
                onClick={() => handleSectionNavigation(item.label)}
                className={`flex w-full items-center gap-3 rounded-full px-5 py-3.5 text-left text-[15px] font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${
                  activeSection === item.label
                    ? "bg-blue-500/95 text-white shadow-lg shadow-blue-900/35"
                    : "bg-slate-800/80 text-slate-100 hover:bg-slate-700"
                }`}
              >
                <item.icon className='h-5 w-5 shrink-0' strokeWidth={2.3} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className='mt-6 rounded-2xl border border-slate-700 bg-slate-800/80 p-4'>
            <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>
              Signed in
            </p>
            <p className='mt-2 truncate text-sm font-medium text-slate-100'>
              {session.user.email}
            </p>
            <p className='mt-1 text-xs text-slate-400'>
              Name: {profile.name || "Not set"}
            </p>
          </div>
          <div className='mt-auto pt-8'>
            <button
              type='button'
              onClick={() => void handleLogout()}
              className='flex w-full items-center gap-3 rounded-full border border-red-400/30 bg-red-500/20 px-5 py-3.5 text-left text-[15px] font-semibold text-red-200 shadow-sm transition-all duration-200 hover:bg-red-500/30 hover:shadow-md hover:-translate-y-0.5 active:scale-95'
            >
              <LogOut className='h-5 w-5 shrink-0' strokeWidth={2.4} />
              Logout
            </button>
          </div>
        </aside>

        <main className='min-w-0 space-y-5 pb-8 lg:pb-0'>
          <div className='hidden items-center justify-end md:flex'>
            <div className='flex items-center gap-3'>
              {themeToggle}
              <button
                type='button'
                onClick={() => handleSectionNavigation("Profile")}
                className='flex min-w-[120px] max-w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-700'
              >
                <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-300'>
                  <User className='h-4 w-4' />
                </div>
                <span className='truncate text-xs font-bold text-slate-800 dark:text-zinc-100'>
                  {profileDisplayLabel}
                </span>
              </button>
            </div>
          </div>
          {activeSection === "Dashboard" && renderDashboard()}
          {activeSection === "Profile" && renderProfile()}
          {activeSection === "History" && renderHistoryTable()}
          {activeSection === "Health Tips" && renderHealthTips()}
          {activeSection === "Medical Standards" && renderMedicalStandards()}
        </main>
      </div>

      {showAddReadingModal ? (
        <div className='fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-900/50 px-4 py-6 dark:bg-black/60'>
          <div
            className='relative mx-auto w-[90%] max-w-[400px] rounded-xl border border-slate-200/80 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900'
            role='dialog'
            aria-modal='true'
            aria-labelledby='add-reading-title'
          >
            <div className='flex items-start justify-between gap-4 border-b border-slate-100 p-6 dark:border-zinc-800'>
              <h2
                id='add-reading-title'
                className='pr-2 text-lg font-semibold text-slate-900 dark:text-zinc-50'
              >
                Enter Blood Pressure Reading
              </h2>
              <button
                type='button'
                onClick={closeAddReadingModal}
                className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                aria-label='Close'
              >
                <svg
                  className='h-5 w-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  aria-hidden
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            </div>
            <form className='p-6' onSubmit={(event) => void addReading(event)}>
              <div className={`${bpFormCardClass} space-y-4`}>
                <div>
                  <label className='block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400'>
                    Age
                  </label>
                  <div className='relative mt-1.5'>
                    <User
                      className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500'
                      strokeWidth={2}
                      aria-hidden
                    />
                    <input
                      value={readingAge}
                      onChange={(event) => {
                        setReadingAge(event.target.value);
                        setBpFormWarning("");
                      }}
                      type='number'
                      min={1}
                      placeholder='22'
                      className='w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-neutral-900 caret-neutral-900 outline-none transition placeholder:text-gray-500 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 dark:border-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-50 dark:placeholder:text-zinc-500'
                    />
                  </div>
                </div>
                <div>
                  <label className='block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400'>
                    Systolic
                  </label>
                  <div className='relative mt-1.5'>
                    <Heart
                      className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500'
                      strokeWidth={2}
                      aria-hidden
                    />
                    <input
                      value={systolic}
                      onChange={(event) => {
                        setSystolic(event.target.value);
                        setBpFormWarning("");
                      }}
                      type='number'
                      min={70}
                      placeholder='120'
                      className='w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-neutral-900 caret-neutral-900 outline-none transition placeholder:text-gray-500 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 dark:border-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-50 dark:placeholder:text-zinc-500'
                    />
                  </div>
                </div>
                <div>
                  <label className='block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400'>
                    Diastolic
                  </label>
                  <div className='relative mt-1.5'>
                    <Activity
                      className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500'
                      strokeWidth={2}
                      aria-hidden
                    />
                    <input
                      value={diastolic}
                      onChange={(event) => {
                        setDiastolic(event.target.value);
                        setBpFormWarning("");
                      }}
                      type='number'
                      min={40}
                      placeholder='80'
                      className='w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-neutral-900 caret-neutral-900 outline-none transition placeholder:text-gray-500 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 dark:border-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-50 dark:placeholder:text-zinc-500'
                    />
                  </div>
                </div>
                {bpFormWarning ? (
                  <p
                    className='text-sm font-medium text-amber-700 dark:text-amber-400'
                    role='alert'
                  >
                    {bpFormWarning}
                  </p>
                ) : null}
                {saveError ? (
                  <p className='text-sm text-red-600 dark:text-red-400'>
                    {saveError}
                  </p>
                ) : null}
                <button
                  type='submit'
                  className={`${primaryBtnClass} w-full rounded-xl py-3.5`}
                >
                  Save Reading
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showResultModal && latestSubmitted ? (
        <div className='fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/45 px-4 py-6 backdrop-blur-sm dark:bg-black/55'>
          <div
            className={`mx-auto max-h-[90vh] w-[95%] max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl ring-2 ring-offset-2 ring-offset-white dark:bg-zinc-900 dark:ring-offset-zinc-950 md:max-w-[700px] ${categoryStyles[latestSubmitted.category].ring}`}
          >
            <div
              className={`px-4 py-3 text-white sm:px-5 sm:py-4 ${modalHeaderClass[latestSubmitted.category]}`}
            >
              <div className='flex items-center justify-between gap-2'>
                <div className='min-w-0'>
                  <p className='truncate text-[9px] font-bold uppercase tracking-[0.2em] text-white/80 sm:text-[10px]'>
                    BP Classification
                  </p>
                  <h3 className='truncate text-lg font-black tracking-tight sm:text-2xl'>
                    {latestSubmitted.category}
                  </h3>
                  <p className='mt-0.5 text-[10px] font-semibold text-white/80 sm:text-xs'>
                    {latestSubmitted.metadata.appliedStandard}
                  </p>
                </div>
                <div className='shrink-0 text-right'>
                  <p className='text-[9px] font-bold uppercase tracking-widest text-white/80 sm:text-[10px]'>
                    Reading
                  </p>
                  <p className='text-base font-black sm:text-xl'>
                    {latestSubmitted.systolic}/{latestSubmitted.diastolic}{" "}
                    <span className='text-[10px] font-normal opacity-80 sm:text-xs'>
                      mmHg
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className='p-4 sm:p-5'>
              {latestSubmitted.metadata.criticalAlert ? (
                <div className='mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 sm:text-sm'>
                  <p className='mb-1 text-[10px] font-black uppercase tracking-wider sm:text-xs'>
                    Critical Alert
                  </p>
                  <p>{CRITICAL_ALERT_GUIDANCE}</p>
                </div>
              ) : null}

              <div className='grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4'>
                {/* Clinical Guidance Column */}
                <div className='rounded-2xl bg-blue-50/50 p-3 ring-1 ring-blue-100 dark:bg-blue-950/20 dark:ring-blue-900/40 sm:p-4'>
                  <div className='mb-2 flex items-center gap-2 sm:mb-3'>
                    <Shield className='h-3.5 w-3.5 text-blue-600 dark:text-blue-400 sm:h-4 sm:w-4' />
                    <p className='text-[10px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300 sm:text-xs'>
                      Clinical Guidance
                    </p>
                  </div>
                  <ul className='space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-zinc-300 sm:space-y-2 sm:text-sm'>
                    {getReadingGuidance(latestSubmitted).map((item) => (
                      <li key={item} className='flex items-start gap-2'>
                        <span className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400 opacity-60' />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Lifestyle Plan Column */}
                <div className='rounded-2xl bg-emerald-50/30 p-3 ring-1 ring-emerald-100 dark:bg-emerald-950/10 dark:ring-emerald-900/30 sm:p-4'>
                  <div className='mb-2 flex items-center gap-2 sm:mb-3'>
                    <Apple className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 sm:h-4 sm:w-4' />
                    <p className='text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300 sm:text-xs'>
                      Lifestyle Plan
                    </p>
                  </div>
                  <ul className='space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-zinc-300 sm:space-y-2 sm:text-sm'>
                    {structuredTips.slice(0, 4).map((tip) => (
                      <li key={tip.title} className='flex items-start gap-2'>
                        <span className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 opacity-60' />
                        <span>
                          <span className='font-bold text-slate-900 dark:text-zinc-100'>
                            {tip.title}:
                          </span>{" "}
                          {tip.points[0]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className='mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800 sm:mt-6 sm:gap-3 sm:pt-5'>
                <button
                  type='button'
                  onClick={downloadClinicalReport}
                  className='inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-[10px] font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 hover:-translate-y-0.5 active:scale-95 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-xs'
                >
                  <svg
                    viewBox='0 0 24 24'
                    fill='currentColor'
                    className='h-3.5 w-3.5 sm:h-4 sm:w-4'
                  >
                    <path d='M12 16l4-5h-3V4h-2v7H8l4 5zm-7 2h14v2H5v-2z' />
                  </svg>
                  PDF Download
                </button>

                <div className='flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-500 ring-1 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-[10px]'>
                  <Shield className='h-3 w-3 sm:h-3.5 sm:w-3.5' />
                  Guidelines
                </div>

                <div className='flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-500 ring-1 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-[10px]'>
                  <Apple className='h-3 w-3 sm:h-3.5 sm:w-3.5' />
                  DASH
                </div>
              </div>

              <hr className='my-4 border-slate-100 dark:border-zinc-800' />
              <p className='mb-4 text-center text-[10px] italic text-slate-400 dark:text-zinc-500'>
                Source: AHA 2017, JNC-8/ACP, ACC/AHA ACS 2021, ESC NSTEMI 2023,
                ESC 2023 and WHO ICD-11 ({latestSubmitted.metadata.icd11Code})
              </p>

              <button
                type='button'
                onClick={() => setShowResultModal(false)}
                className='mt-4 w-full rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-200 active:scale-[0.98] dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 sm:py-3 sm:text-sm'
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
