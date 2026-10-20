import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FullPageLoader } from "@/components/FullPageLoader";
import { Logo } from "@/components/Logo";
import { DisplayTitle, MetaRow } from "@/components/gallery";
import { ApiError, authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Institution } from "@/lib/types";
import { cn } from "@/lib/utils";

type Role = "STUDENT" | "TEACHER";

const approvalNote: Record<Role, string> = {
  TEACHER: "Instant access — no approval needed.",
  STUDENT: "Requires Teacher approval.",
};

const successMessage: Record<Role, string> = {
  TEACHER:
    "Your teacher account is active! You can sign in now.",
  STUDENT:
    "Your registration has been submitted successfully. Your account will become active after approval by a Teacher.",
};

/** Glass-aesthetic input treatment for the auth cards (overrides solid bg-deep). */
const glassInput =
  "bg-white/[0.08] border-white/25 text-bone placeholder:text-ash/80 shadow-none ring-offset-transparent focus-visible:border-cyan/60 focus-visible:ring-cyan/35";

/** Full-viewport auth canvas: Celestial Cityscape + subtle left gradient. */
function AuthCanvas({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden text-bone lg:flex-row">
      <div aria-hidden className="auth-backdrop absolute inset-0 -z-20" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(105deg,rgba(3,18,26,0.78)_0%,rgba(3,18,26,0.45)_26%,rgba(3,18,26,0.12)_50%,rgba(3,18,26,0.04)_100%)]"
      />
      {children}
    </div>
  );
}

export function RegisterPage() {
  const { status, registerStudent, registerTeacher } = useAuth();
  const [role, setRole] = useState<Role>("STUDENT");
  // Shared fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState(false);
  // Teacher-only
  const [employeeId, setEmployeeId] = useState("");
  // Student-only
  const [usn, setUsn] = useState("");
  const [semester, setSemester] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Fetch institutions for the dropdown
  useEffect(() => {
    authApi.listInstitutions().then(({ institutions }) => {
      setInstitutions(institutions);
      setInstitutionsLoading(false);
    }).catch(() => {
      setInstitutionsLoading(false);
    });
  }, []);

  if (status === "loading") return <FullPageLoader />;
  if (status === "authenticated") return <Navigate to="/app" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!consent) {
      setError("You must accept the consent to create an account.");
      return;
    }
    if (!schoolId) {
      setError("Please select your institution.");
      return;
    }
    setSubmitting(true);
    try {
      const [firstName = fullName, ...rest] = fullName.trim().split(/\s+/);
      const lastName = rest.join(" ") || firstName;
      const base = {
        email,
        password,
        firstName,
        lastName,
        consent: true as const,
        schoolId,
        ...(department.trim() ? { department: department.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      };
      if (role === "STUDENT") {
        await registerStudent({
          ...base,
          ...(usn.trim() ? { usn: usn.trim() } : {}),
          ...(semester.trim() ? { semester: semester.trim() } : {}),
        });
      } else {
        await registerTeacher({
          ...base,
          ...(employeeId.trim() ? { employeeId: employeeId.trim() } : {}),
        });
      }
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.details && typeof err.details === "object") {
        const fieldErrors = Object.entries(err.details)
          .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
          .join("; ");
        setError(fieldErrors || err.message);
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <AuthCanvas>
        <RegisterBranding />
        <main className="relative flex flex-1 flex-col justify-center px-5 py-12 sm:px-10 lg:w-[48%] lg:px-12 lg:py-12">
          <div className="animate-gallery-rise mx-auto w-full max-w-md">
            <div className="auth-glass rounded-[18px] p-7 text-center sm:p-9">
              <p className="font-micro text-[10px] uppercase tracking-[0.28em] text-emerald">Registration submitted</p>
              <h1 className="mt-3 font-display text-[32px] font-medium leading-[1.05] tracking-tight text-bone">
                You are in
              </h1>
              <div className="gallery-rule mt-6 pt-6">
                <p className="font-micro text-[11px] uppercase leading-relaxed text-ash">{successMessage[role]}</p>
                <div className="mt-6">
                  <Link to="/login">
                    <Button variant="outline" className="w-full">
                      Back to sign in
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      </AuthCanvas>
    );
  }

  return (
    <AuthCanvas>
      <RegisterBranding />

      <main className="relative flex flex-1 flex-col px-5 py-12 sm:px-10 lg:w-[48%] lg:px-12 lg:py-12">
        <div className="mx-auto w-full max-w-xl py-2 animate-gallery-rise">
          <div className="auth-glass rounded-[18px] p-6 sm:p-8">
            <p className="font-micro text-[10px] uppercase tracking-[0.28em] text-emerald">
              <span aria-hidden className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald shadow-[0_0_10px_rgba(46,207,143,0.9)]" />
              Join the learning community
            </p>
            <h1 className="mt-3 font-display text-[32px] font-medium leading-[1.05] tracking-tight text-bone">
              Create an account
            </h1>

            <div className="gallery-rule mt-6 pt-6">
              <div className="grid grid-cols-2 gap-1.5 rounded-[6px] border border-white/20 bg-white/[0.06] p-1.5">
                {(["STUDENT", "TEACHER"] as const).map((option) => (
                  <button
                    key={option}
                      type="button"
                      onClick={() => {
                        setRole(option);
                        setError(null);
                      }}
                      className={cn(
                        "h-10 rounded-[4px] font-micro text-[11px] uppercase tracking-[0.1em] transition-colors",
                        role === option
                          ? "bg-charcoal text-white shadow-[0_10px_24px_-18px_rgba(46,207,143,0.95)]"
                          : "text-ash hover:text-bone",
                      )}
                    >
                      {option === "STUDENT" ? "I am a Student" : "I am a Teacher"}
                    </button>
                  ))}
              </div>

              <p className="mt-4 rounded-[6px] border border-white/15 bg-white/[0.06] px-3 py-2.5 text-center font-micro text-[10px] uppercase tracking-[0.1em] text-ash">
                {approvalNote[role]}
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    autoComplete="name"
                    required
                    className={glassInput}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    className={glassInput}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schoolId">Institution / School / College *</Label>
                  <select
                    id="schoolId"
                    required
                    value={schoolId}
                    onChange={(e) => setSchoolId(e.target.value)}
                    disabled={institutionsLoading}
                    className={cn(
                      "flex h-10 w-full rounded-[6px] border border-white/25 bg-white/[0.08] px-3.5 py-2.5 text-sm text-bone focus-visible:border-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/35",
                      !schoolId && "text-ash/70"
                    )}
                  >
                    <option value="">
                      {institutionsLoading ? "Loading institutions..." : "Select your institution"}
                    </option>
                    {institutions.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}{inst.city ? ` — ${inst.city}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department / Class</Label>
                    <Input
                      id="department"
                      className={glassInput}
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </div>
                  {role === "TEACHER" ? (
                    <div className="space-y-2">
                      <Label htmlFor="employeeId">Employee ID (optional)</Label>
                      <Input
                        id="employeeId"
                        className={cn(glassInput, inputClass(employeeId))}
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="usn">USN / Roll number</Label>
                      <Input
                        id="usn"
                        className={cn(glassInput, inputClass(usn))}
                        value={usn}
                        onChange={(e) => setUsn(e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      className={cn(glassInput, inputClass(phone))}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  {role === "STUDENT" && (
                    <div className="space-y-2">
                      <Label htmlFor="semester">Semester / Grade</Label>
                      <Input
                        id="semester"
                        className={cn(glassInput, inputClass(semester))}
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className={glassInput}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className={glassInput}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2 font-micro text-[10px] uppercase leading-relaxed tracking-[0.08em] text-ash">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded-[2px] border-frost/40 accent-emerald"
                  />
                  <span>
                    I understand this is a demo and consent to my account and activity data being stored.
                  </span>
                </label>

                {error && (
                  <p role="alert" className="rounded-[6px] border border-destructive/40 bg-destructive/10 px-3 py-2 font-micro text-[11px] text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={submitting || !consent}>
                  {submitting ? "Creating account…" : "Create account"}
                </Button>
              </form>

              <p className="mt-6 font-micro text-[10px] uppercase tracking-[0.14em] text-ash">
                Already have an account?{" "}
                <Link to="/login" className="text-cyan underline-offset-4 hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </AuthCanvas>
  );

  function inputClass(value: string): string {
    return value.length === 0 ? "opacity-70" : "";
  }
}

/** EcoSphere branding over the full-screen cityscape — left side of both register states. */
function RegisterBranding() {
  return (
    <aside className="relative flex flex-1 flex-col justify-between px-6 py-8 sm:px-10 lg:min-h-screen lg:w-[52%] lg:px-14 lg:py-12">
      <header className="flex items-center gap-2.5">
        <Logo className="h-7 w-7" />
        <span className="font-display text-sm font-medium tracking-[0.28em] text-bone">ECOSPHERE</span>
      </header>

      <div className="max-w-xl animate-gallery-rise pb-8 lg:pb-0">
        <p className="flex items-center gap-3 font-micro text-[11px] uppercase tracking-[0.34em] text-cyan">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-cyan animate-pulse-glow" />
          New explorer
        </p>
        <DisplayTitle lines={["JOIN THE", "ADVENTURE"]} className="mt-5" />
        <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ash">
          Create your profile to receive missions from your teachers, take quizzes and earn XP for
          real-world environmental action.
        </p>
        <MetaRow className="mt-8">
          <span>Missions &amp; quizzes</span>
          <span>Teacher approved</span>
          <span>XP from day one</span>
        </MetaRow>
      </div>
    </aside>
  );
}
