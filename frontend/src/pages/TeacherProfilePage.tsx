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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/quests";

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

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading profile...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <User className="h-6 w-6 text-primary" aria-hidden />
          Teacher Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          View and manage your teacher profile, verification status, and Teacher ID.
        </p>
      </section>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {successMsg && (
        <p role="status" className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          {successMsg}
        </p>
      )}

      {/* Main Avatar & Profile Banner */}
      <Card className="border border-border bg-card">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xl font-bold text-primary ring-2 ring-primary/30">
                {initials}
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {profile?.firstName} {profile?.lastName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {profile?.teacherProfile?.designation || "Faculty Member"}
                  {profile?.teacherProfile?.department ? ` • ${profile.teacherProfile.department}` : ""}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3.5 w-3.5" aria-hidden />
                  {profile?.school?.name || "No Institution Assigned"}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  verificationStatus === "VERIFIED"
                    ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                    : verificationStatus === "REJECTED"
                      ? "bg-red-500/15 text-red-600 border border-red-500/30"
                      : verificationStatus === "SUSPENDED"
                        ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                        : "bg-blue-500/15 text-blue-600 border border-blue-500/30"
                }`}
              >
                {verificationStatus === "VERIFIED" && <BadgeCheck className="h-4 w-4" aria-hidden />}
                {verificationStatus === "PENDING" && <Clock className="h-4 w-4 animate-pulse" aria-hidden />}
                {verificationStatus === "REJECTED" && <XCircle className="h-4 w-4" aria-hidden />}
                {verificationStatus === "SUSPENDED" && <AlertTriangle className="h-4 w-4" aria-hidden />}

                {verificationStatus === "VERIFIED"
                  ? "✓ Verified Teacher"
                  : verificationStatus === "REJECTED"
                    ? "✕ Verification Rejected"
                    : verificationStatus === "SUSPENDED"
                      ? "⚠ Account Suspended"
                      : "⏳ Verification Pending"}
              </span>

              {teacherId && (
                <div className="flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1 text-xs font-mono font-bold">
                  <KeyRound className="h-3.5 w-3.5 text-primary" aria-hidden />
                  <span>Teacher ID:</span>
                  <code className="text-primary">{teacherId}</code>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Institution Selection / Verification Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" aria-hidden />
            Institution & Verification
          </CardTitle>
          <CardDescription>
            {isVerified
              ? "Your institution membership is verified and active."
              : "Select your school, college, or institute."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="grid gap-2 sm:grid-cols-3 sm:items-center">
              <label htmlFor="institution-select" className="text-sm font-medium text-muted-foreground">
                Institution / School / College
              </label>
              <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2">
                <select
                  id="institution-select"
                  disabled={assigning}
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
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
                  {assigning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                  Update Institution
                </Button>
              </div>
            </div>

            {verificationStatus === "PENDING" && (
              <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-300">
                <p className="font-semibold">⏳ Verification Pending</p>
                <p className="mt-1">
                  Your account is linked to <strong>{profile?.school?.name || "your institution"}</strong> and
                  you have full access. Your server-generated Teacher ID will appear automatically.
                </p>
              </div>
            )}

            {verificationStatus === "VERIFIED" && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                <div>
                  <p className="font-semibold">✓ Verified Teacher Account</p>
                  <p className="mt-1">
                    You have full verified teacher privileges for <strong>{profile?.school?.name}</strong>.
                  </p>
                </div>
                {profile?.teacherProfile?.verifiedAt && (
                  <span className="text-[11px] opacity-80 shrink-0">
                    Verified on {formatDate(profile.teacherProfile.verifiedAt)}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Profile Details Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" aria-hidden />
              Profile Details
            </CardTitle>
            <CardDescription>Personal and professional information</CardDescription>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit3 className="h-4 w-4" aria-hidden />
              Edit Profile
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Read-only fields */}
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="text-sm font-medium">{profile?.firstName} {profile?.lastName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div>
                <p className="text-xs text-muted-foreground">Email Address</p>
                <p className="text-sm font-medium">{profile?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div>
                <p className="text-xs text-muted-foreground">Institution</p>
                <p className="text-sm font-medium">{profile?.school?.name ?? "Unassigned"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div>
                <p className="text-xs text-muted-foreground">Member Since</p>
                <p className="text-sm font-medium">{profile?.createdAt ? formatDate(profile.createdAt) : "—"}</p>
              </div>
            </div>

            {/* Editable fields */}
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Phone</p>
                {editing ? (
                  <Input
                    value={form.phone ?? ""}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="Phone number"
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm font-medium">{profile?.teacherProfile?.phone ?? "—"}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Department</p>
                {editing ? (
                  <Input
                    value={form.department ?? ""}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="e.g., Computer Science and Engineering"
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm font-medium">{profile?.teacherProfile?.department ?? "—"}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Designation</p>
                {editing ? (
                  <Input
                    value={form.designation ?? ""}
                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    placeholder="e.g., Assistant Professor"
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm font-medium">{profile?.teacherProfile?.designation ?? "—"}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Employee ID</p>
                {editing ? (
                  <Input
                    value={form.employeeId ?? ""}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    placeholder="Internal employee ID"
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm font-medium">{profile?.teacherProfile?.employeeId ?? "—"}</p>
                )}
              </div>
            </div>
          </div>

          {/* Bio section */}
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-1">Bio / About</p>
            {editing ? (
              <textarea
                value={form.bio ?? ""}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="A short bio about yourself..."
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            ) : (
              <p className="text-sm">{profile?.teacherProfile?.bio || "No bio added."}</p>
            )}
          </div>

          {editing && (
            <div className="mt-4 flex items-center gap-2">
              <Button size="sm" onClick={() => void onSave()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                Save Changes
              </Button>
              <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
                <X className="h-4 w-4" aria-hidden />
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
