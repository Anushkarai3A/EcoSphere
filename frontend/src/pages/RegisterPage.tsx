import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FullPageLoader } from "@/components/FullPageLoader";
import { Logo } from "@/components/Logo";
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
      <div className="flex min-h-screen flex-col bg-void px-5 pb-10 text-bone sm:px-10">
        <header className="flex h-10 items-center gap-2">
          <Logo className="h-5 w-5" />
          <span className="font-display text-sm font-normal tracking-[0.08em]">ECOSPHERE</span>
        </header>
        <main className="flex flex-1 flex-col justify-center gap-6 py-10">
          <p className="font-micro text-[11px] uppercase text-ash">Registration submitted</p>
          <h1 className="text-gallery-display text-white">
            <span className="block"><span className="gallery-underline">YOU ARE</span></span>
            <span className="block"><span className="gallery-underline">IN</span></span>
          </h1>
          <p className="max-w-md font-micro text-[11px] uppercase leading-relaxed text-ash">{successMessage[role]}</p>
          <div>
            <Link to="/login">
              <Button variant="outline">Back to sign in</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-void px-5 pb-10 text-bone sm:px-10">
      <header className="flex h-10 items-center gap-2">
        <Logo className="h-5 w-5" />
        <span className="font-display text-sm font-normal tracking-[0.08em]">ECOSPHERE</span>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 py-10">
          <div>
            <p className="font-micro text-[11px] uppercase text-ash">Join the learning community</p>
            <h1 className="mt-4 text-gallery-display text-white">
              <span className="block"><span className="gallery-underline">CREATE AN</span></span>
              <span className="block"><span className="gallery-underline">ACCOUNT</span></span>
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-2 border border-frost/25 p-1">
            {(["STUDENT", "TEACHER"] as const).map((option) => (
              <button
                key={option}
                  type="button"
                  onClick={() => {
                    setRole(option);
                    setError(null);
                  }}
                  className={cn(
                    "h-9 font-micro text-[11px] uppercase transition-colors",
                    role === option
                      ? "bg-charcoal text-white"
                      : "text-white/55 hover:text-white",
                  )}
                >
                  {option === "STUDENT" ? "I am a Student" : "I am a Teacher"}
                </button>
              ))}
          </div>

          <p className="border border-frost/25 px-3 py-2 text-center font-micro text-[11px] uppercase text-ash">
            {approvalNote[role]}
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                autoComplete="name"
                required
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
                  "flex h-10 w-full rounded-[2px] border border-frost/30 bg-void px-3 py-2 text-sm text-white ring-offset-void focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-frost",
                  !schoolId && "text-ash/60"
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
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
              {role === "TEACHER" ? (
                <div className="space-y-2">
                  <Label htmlFor="employeeId">Employee ID (optional)</Label>
                  <Input
                    id="employeeId"
                    className={inputClass(employeeId)}
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="usn">USN / Roll number</Label>
                  <Input
                    id="usn"
                    className={inputClass(usn)}
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
                  className={inputClass(phone)}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {role === "STUDENT" && (
                <div className="space-y-2">
                  <Label htmlFor="semester">Semester / Grade</Label>
                  <Input
                    id="semester"
                    className={inputClass(semester)}
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
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <label className="flex items-start gap-2 font-micro text-[11px] uppercase leading-relaxed text-ash">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded-[2px] border-frost/40 accent-white"
              />
              <span>
                I understand this is a demo and consent to my account and activity data being stored.
              </span>
            </label>

            {error && (
              <p role="alert" className="font-micro text-[11px] text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting || !consent}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="font-micro text-[11px] uppercase text-ash">
            Already have an account?{" "}
            <Link to="/login" className="text-white underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </main>
    </div>
  );

  function inputClass(value: string): string {
    return value.length === 0 ? "opacity-70" : "";
  }
}