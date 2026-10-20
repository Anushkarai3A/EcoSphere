import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Edit3,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Save,
  Shield,
  User,
  X,
  Clock,
  XCircle,
  AlertTriangle,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { authApi, teacherApi } from "@/lib/api";
import type { Institution, TeacherProfileData, UpdateTeacherProfileInput } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DisplayTitle, MetaRow, Rule, SectionHead } from "@/components/gallery";
import { formatDate } from "@/lib/quests";
import { cn } from "@/lib/utils";

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-micro text-[10px] uppercase tracking-[0.06em]";

const verificationTone: Record<string, string> = {
  VERIFIED: "border-emerald/40 bg-emerald/10 text-emerald",
  PENDING: "border-gold/40 bg-gold/10 text-gold",
  REJECTED: "border-destructive/40 bg-destructive/10 text-destructive",
  SUSPENDED: "border-orange/40 bg-orange/10 text-orange",
};

const selectClass =
  "h-10 w-full rounded-[6px] border border-frost/40 bg-deep px-3.5 py-2.5 text-sm text-bone shadow-[inset_0_1px_2px_rgba(3,18,26,0.6)] transition-colors focus-visible:border-cyan/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/35 disabled:cursor-not-allowed disabled:opacity-70";

function FieldRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] border border-frost/15 bg-white/[0.03] p-4">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ash" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-micro text-[10px] uppercase leading-none tracking-[0.16em] text-ash">{label}</p>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

export function TeacherProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<TeacherProfileData | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UpdateTeacherProfileInput>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, instRes] = await Promise.all([
        teacherApi.getProfile(),
        authApi.listInstitutions().catch(() => ({ institutions: [] })),
      ]);
      setProfile(data);
      setInstitutions(instRes.institutions);
      const curSchoolId = data.schoolId || data.teacherProfile?.schoolId || "";
      setSelectedSchoolId(curSchoolId);
      setForm({
        phone: data.teacherProfile?.phone ?? "",
        bio: data.teacherProfile?.bio ?? "",
        department: data.teacherProfile?.department ?? "",
        designation: data.teacherProfile?.designation ?? "",
        employeeId: data.teacherProfile?.employeeId ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onAssignInstitution = async () => {
    if (!selectedSchoolId) {
      setError("Please select an institution first");
      return;
    }
    setAssigning(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await teacherApi.assignInstitution(selectedSchoolId);
      setProfile(updated);
      setSuccessMsg("Institution updated!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign institution");
    } finally {
      setAssigning(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await teacherApi.updateProfile(form);
      setProfile(updated);
      setEditing(false);
      setSuccessMsg("Profile updated successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    if (!profile) return;
    setForm({
      phone: profile.teacherProfile?.phone ?? "",
      bio: profile.teacherProfile?.bio ?? "",
      department: profile.teacherProfile?.department ?? "",
      designation: profile.teacherProfile?.designation ?? "",
      employeeId: profile.teacherProfile?.employeeId ?? "",
    });
    setEditing(false);
    setError(null);
  };

  const verificationStatus = profile?.teacherProfile?.verificationStatus ?? "PENDING";
  const teacherId = profile?.teacherProfile?.teacherId;
  const isVerified = verificationStatus === "VERIFIED";

  // Compute initials for Avatar
  const firstName = profile?.firstName ?? user?.firstName ?? "";
  const lastName = profile?.lastName ?? user?.lastName ?? "";
  const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase() || "T";

  const verificationLabel =
    verificationStatus === "VERIFIED"
      ? "Verified teacher"
      : verificationStatus === "REJECTED"
        ? "Verification rejected"
        : verificationStatus === "SUSPENDED"
          ? "Account suspended"
          : "Verification pending";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Loader2 className="h-5 w-5 animate-spin text-emerald" aria-hidden />
        <p className="font-micro text-[11px] uppercase text-ash">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-16 px-5 pb-16 sm:px-10">
      <section className="flex flex-col gap-5 pt-12 animate-gallery-rise">
        <MetaRow>
          <span>Teacher workspace</span>
          <span>{isVerified ? "Verified teacher" : `Verification ${verificationStatus.toLowerCase()}`}</span>
        </MetaRow>
        <DisplayTitle lines={["PROFILE"]} />
        <p className="max-w-xl font-micro text-[11px] leading-[1.6] uppercase text-ash">
          View and manage your teacher profile, verification status, and Teacher ID.
        </p>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-4 py-3 font-micro text-[11px] uppercase text-destructive"
        >
          {error}
        </p>
      )}

      {successMsg && (
        <p
          role="status"
          className="rounded-[10px] border border-emerald/40 bg-emerald/10 px-4 py-3 font-micro text-[11px] uppercase text-emerald"
        >
          {successMsg}
        </p>
      )}

      <Rule />

      {/* Main Avatar & Profile Banner */}
      <section className="flex flex-col gap-5">
        <SectionHead kicker="Identity" title="Profile summary" />
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-emerald/40 bg-emerald/10 font-title text-[24px] font-semibold text-emerald">
                {initials}
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-[26px] font-medium leading-[1.15] text-bone">
                  {profile?.firstName} {profile?.lastName}
                </h2>
                <p className="mt-1 font-micro text-[11px] uppercase text-ash">
                  {profile?.teacherProfile?.designation || "Faculty Member"}
                  {profile?.teacherProfile?.department ? ` • ${profile.teacherProfile.department}` : ""}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 font-micro text-[10px] uppercase text-ash">
                  <Building2 className="h-3.5 w-3.5" aria-hidden />
                  {profile?.school?.name || "No Institution Assigned"}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-2 sm:items-end">
              <span className={cn(chipBase, verificationTone[verificationStatus] ?? verificationTone.PENDING)}>
                {verificationStatus === "VERIFIED" && <BadgeCheck className="h-3.5 w-3.5" aria-hidden />}
                {verificationStatus === "PENDING" && <Clock className="h-3.5 w-3.5" aria-hidden />}
                {verificationStatus === "REJECTED" && <XCircle className="h-3.5 w-3.5" aria-hidden />}
                {verificationStatus === "SUSPENDED" && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
                {verificationLabel}
              </span>

              {teacherId && (
                <span className={cn(chipBase, "border-cyan/40 bg-cyan/10 text-cyan")}>
                  <KeyRound className="h-3.5 w-3.5" aria-hidden />
                  <span>Teacher ID</span>
                  <code className="font-micro text-[10px] tracking-normal">{teacherId}</code>
                </span>
              )}
            </div>
          </div>
        </Card>
      </section>

      <Rule />

      {/* Institution Selection / Verification Status */}
      <section className="flex flex-col gap-5">
        <SectionHead
          kicker="Membership"
          title="Institution & verification"
          right={
            <span className={cn(chipBase, isVerified ? "border-emerald/40 bg-emerald/10 text-emerald" : "border-gold/40 bg-gold/10 text-gold")}>
              {isVerified ? "Active" : "Action required"}
            </span>
          }
        />
        <Card>
          <p className="font-micro text-[11px] uppercase leading-[1.6] text-ash">
            {isVerified ? "Your institution membership is verified and active." : "Select your school, college, or institute."}
          </p>

          <div className="mt-4 flex flex-col gap-4">
            <div className="grid gap-2 sm:grid-cols-3 sm:items-center">
              <label htmlFor="institution-select" className="font-micro text-[10px] uppercase leading-none tracking-[0.16em] text-ash">
                Institution / School / College
              </label>
              <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
                <select
                  id="institution-select"
                  disabled={assigning}
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">-- Select Institution --</option>
                  {institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} {inst.city ? `(${inst.city})` : ""}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => void onAssignInstitution()}
                  disabled={assigning || !selectedSchoolId || selectedSchoolId === (profile?.schoolId || "")}
                >
                  {assigning ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden />
                  )}
                  Update Institution
                </Button>
              </div>
            </div>

            {verificationStatus === "PENDING" && (
              <div className="rounded-[10px] border border-gold/40 bg-gold/10 p-4 font-micro text-[11px] uppercase leading-[1.6] text-ash">
                <p className="inline-flex items-center gap-2 text-gold">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  Verification pending
                </p>
                <p className="mt-1.5">
                  Your account is linked to{" "}
                  <strong className="font-normal text-bone">{profile?.school?.name || "your institution"}</strong> and
                  you have full access. Your server-generated Teacher ID will appear automatically.
                </p>
              </div>
            )}

            {verificationStatus === "VERIFIED" && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-emerald/40 bg-emerald/10 p-4 font-micro text-[11px] uppercase leading-[1.6] text-ash">
                <div>
                  <p className="inline-flex items-center gap-2 text-emerald">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    Verified teacher account
                  </p>
                  <p className="mt-1.5">
                    You have full verified teacher privileges for{" "}
                    <strong className="font-normal text-bone">{profile?.school?.name}</strong>.
                  </p>
                </div>
                {profile?.teacherProfile?.verifiedAt && (
                  <span className="shrink-0 text-[10px] text-ash">
                    Verified on {formatDate(profile.teacherProfile.verifiedAt)}
                  </span>
                )}
              </div>
            )}

            {verificationStatus === "REJECTED" && (
              <div className="rounded-[10px] border border-destructive/40 bg-destructive/10 p-4 font-micro text-[11px] uppercase leading-[1.6] text-ash">
                <p className="inline-flex items-center gap-2 text-destructive">
                  <XCircle className="h-3.5 w-3.5" aria-hidden />
                  Verification rejected
                </p>
                <p className="mt-1.5">
                  Contact your institution administrator to resolve this and re-submit your details.
                </p>
              </div>
            )}
          </div>
        </Card>
      </section>

      <Rule />

      {/* Profile Details */}
      <section className="flex flex-col gap-5">
        <SectionHead
          kicker="Details"
          title="Personal & professional"
          right={
            !editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Edit3 className="h-4 w-4" aria-hidden />
                Edit Profile
              </Button>
            ) : undefined
          }
        />
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldRow icon={User} label="Full name">
              <p className="truncate text-sm text-bone">
                {profile?.firstName} {profile?.lastName}
              </p>
            </FieldRow>
            <FieldRow icon={Mail} label="Email address">
              <p className="truncate text-sm text-bone">{profile?.email}</p>
            </FieldRow>
            <FieldRow icon={Building2} label="Institution">
              <p className="truncate text-sm text-bone">{profile?.school?.name ?? "Unassigned"}</p>
            </FieldRow>
            <FieldRow icon={CalendarDays} label="Member since">
              <p className="text-sm text-bone">{profile?.createdAt ? formatDate(profile.createdAt) : "—"}</p>
            </FieldRow>

            <FieldRow icon={Phone} label="Phone">
              {editing ? (
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone number"
                  className="h-9"
                />
              ) : (
                <p className="text-sm text-bone">{profile?.teacherProfile?.phone ?? "—"}</p>
              )}
            </FieldRow>
            <FieldRow icon={Shield} label="Department">
              {editing ? (
                <Input
                  value={form.department ?? ""}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="e.g., Computer Science and Engineering"
                  className="h-9"
                />
              ) : (
                <p className="text-sm text-bone">{profile?.teacherProfile?.department ?? "—"}</p>
              )}
            </FieldRow>
            <FieldRow icon={BadgeCheck} label="Designation">
              {editing ? (
                <Input
                  value={form.designation ?? ""}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  placeholder="e.g., Assistant Professor"
                  className="h-9"
                />
              ) : (
                <p className="text-sm text-bone">{profile?.teacherProfile?.designation ?? "—"}</p>
              )}
            </FieldRow>
            <FieldRow icon={KeyRound} label="Employee ID">
              {editing ? (
                <Input
                  value={form.employeeId ?? ""}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  placeholder="Internal employee ID"
                  className="h-9"
                />
              ) : (
                <p className="text-sm text-bone">{profile?.teacherProfile?.employeeId ?? "—"}</p>
              )}
            </FieldRow>
          </div>

          {/* Bio section */}
          <div className="mt-4 rounded-[10px] border border-frost/15 bg-white/[0.03] p-4">
            <p className="font-micro text-[10px] uppercase leading-none tracking-[0.16em] text-ash">Bio / About</p>
            {editing ? (
              <textarea
                value={form.bio ?? ""}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="A short bio about yourself..."
                rows={3}
                className="mt-2 w-full resize-y rounded-[6px] border border-frost/40 bg-deep px-3.5 py-2.5 text-sm text-bone shadow-[inset_0_1px_2px_rgba(3,18,26,0.6)] placeholder:text-ash/70 transition-colors focus-visible:border-cyan/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/35"
              />
            ) : (
              <p className="mt-2 text-sm leading-[1.7] text-bone">{profile?.teacherProfile?.bio || "No bio added."}</p>
            )}
          </div>

          {editing && (
            <div className="mt-4 flex flex-col-reverse items-stretch gap-2 border-t border-frost/15 pt-4 sm:flex-row sm:items-center">
              <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
                <X className="h-4 w-4" aria-hidden />
                Cancel
              </Button>
              <Button size="sm" onClick={() => void onSave()} disabled={saving} className="sm:self-end">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="h-4 w-4" aria-hidden />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
