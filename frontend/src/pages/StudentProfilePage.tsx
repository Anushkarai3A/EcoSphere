import { useCallback, useEffect, useState } from "react";
import {
  Award,
  BadgeCheck,
  Building2,
  CalendarDays,
  Edit3,
  Flame,
  GraduationCap,
  Hash,
  Loader2,
  Lock,
  Mail,
  Phone,
  Save,
  Shield,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { studentApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/quests";
import type { StudentBadge, StudentProfileData, UpdateStudentProfileInput } from "@/lib/types";

export function StudentProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [allBadges, setAllBadges] = useState<StudentBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState<UpdateStudentProfileInput>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profRes, badgesRes] = await Promise.all([
        studentApi.getProfile(),
        studentApi.getBadges().catch(() => ({ badges: [] })),
      ]);
      setProfile(profRes);
      setAllBadges(badgesRes.badges || []);
      setForm({
        phone: profRes.studentProfile?.phone ?? "",
        department: profRes.studentProfile?.department ?? "",
        semester: profRes.studentProfile?.semester ?? "",
        grade: profRes.studentProfile?.grade ?? "",
        usn: profRes.studentProfile?.usn ?? "",
        privacyMode: profRes.studentProfile?.privacyMode ?? false,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load student profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await studentApi.updateProfile(form);
      setProfile(updated);
      setEditing(false);
      setSuccessMsg("Profile updated successfully!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    if (!profile) return;
    setForm({
      phone: profile.studentProfile?.phone ?? "",
      department: profile.studentProfile?.department ?? "",
      semester: profile.studentProfile?.semester ?? "",
      grade: profile.studentProfile?.grade ?? "",
      usn: profile.studentProfile?.usn ?? "",
      privacyMode: profile.studentProfile?.privacyMode ?? false,
    });
    setEditing(false);
    setError(null);
  };

  const firstName = profile?.firstName ?? user?.firstName ?? "";
  const lastName = profile?.lastName ?? user?.lastName ?? "";
  const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase() || "S";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
        <p className="text-sm font-medium">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12">
      {/* Top Header */}
      <section>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <User className="h-6 w-6 text-primary" aria-hidden />
          Student Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your academic details, view earned badges, and configure leaderboard privacy settings.
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
                  {profile?.studentProfile?.department || "Student"}
                  {profile?.studentProfile?.semester ? ` • Semester ${profile.studentProfile.semester}` : ""}
                  {profile?.studentProfile?.grade ? ` • ${profile.studentProfile.grade}` : ""}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3.5 w-3.5" aria-hidden />
                  {profile?.school?.name || "Ecosphere Institution"}
                  {profile?.school?.city ? ` (${profile.school.city})` : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                <BadgeCheck className="h-4 w-4" aria-hidden />
                Verified Student Account
              </span>

              {profile?.studentProfile?.streakCount !== undefined && (
                <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Flame className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  <span>{profile.studentProfile.streakCount} Day Activity Streak</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Details Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
              Academic & Personal Information
            </CardTitle>
            <CardDescription>Keep your academic records up to date for your teachers.</CardDescription>
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
            {/* Read-only Identity Fields */}
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
                <p className="text-xs text-muted-foreground">Institution (Read-only)</p>
                <p className="text-sm font-medium text-primary">{profile?.school?.name ?? "Unassigned"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div>
                <p className="text-xs text-muted-foreground">Registered Since</p>
                <p className="text-sm font-medium">{profile?.createdAt ? formatDate(profile.createdAt) : "—"}</p>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">USN / Roll Number</p>
                {editing ? (
                  <Input
                    value={form.usn ?? ""}
                    onChange={(e) => setForm({ ...form, usn: e.target.value })}
                    placeholder="e.g. 1RV22CS001"
                    className="h-8 text-sm mt-1"
                  />
                ) : (
                  <p className="text-sm font-medium">{profile?.studentProfile?.usn ?? "Not provided"}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Department / Major</p>
                {editing ? (
                  <Input
                    value={form.department ?? ""}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="e.g. Environmental Science"
                    className="h-8 text-sm mt-1"
                  />
                ) : (
                  <p className="text-sm font-medium">{profile?.studentProfile?.department ?? "Not provided"}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Semester</p>
                {editing ? (
                  <Input
                    value={form.semester ?? ""}
                    onChange={(e) => setForm({ ...form, semester: e.target.value })}
                    placeholder="e.g. 5"
                    className="h-8 text-sm mt-1"
                  />
                ) : (
                  <p className="text-sm font-medium">{profile?.studentProfile?.semester ?? "Not provided"}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Phone Number</p>
                {editing ? (
                  <Input
                    value={form.phone ?? ""}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="e.g. +91 9876543210"
                    className="h-8 text-sm mt-1"
                  />
                ) : (
                  <p className="text-sm font-medium">{profile?.studentProfile?.phone ?? "Not provided"}</p>
                )}
              </div>
            </div>
          </div>

          {/* Privacy Mode Option */}
          <div className="mt-6 pt-4 border-t border-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-primary" />
                  Privacy Mode (Leaderboard Anonymization)
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When enabled, your name will appear as "Anonymous Eco Scout" on the campus leaderboard.
                </p>
              </div>

              {editing ? (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.privacyMode ?? false}
                    onChange={(e) => setForm({ ...form, privacyMode: e.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="ml-2 text-xs font-medium">Enable</span>
                </label>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted">
                  {profile?.studentProfile?.privacyMode ? "Active (Hidden)" : "Off (Visible)"}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          {editing && (
            <div className="mt-6 flex items-center gap-2 justify-end border-t border-border pt-4">
              <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={() => void onSave()} disabled={saving} className="bg-primary">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save Changes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Earned Badges Showcase */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" aria-hidden />
            Eco Badges & Achievements
          </CardTitle>
          <CardDescription>Badges earned through environmental action and academic milestones.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {allBadges.map((badge) => {
              const isEarned = badge.isEarned || profile?.userBadges?.some((ub) => ub.badge.key === badge.key);
              return (
                <div
                  key={badge.id}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 transition-all ${
                    isEarned
                      ? "border-amber-400/40 bg-amber-500/10 shadow-sm"
                      : "border-border/60 bg-muted/20 opacity-60"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      isEarned ? "bg-amber-500 text-white shadow" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-xs truncate">{badge.name}</h4>
                      {isEarned ? (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">✓ Unlocked</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Locked</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{badge.description}</p>
                    {badge.xpBonus && (
                      <span className="inline-block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                        +{badge.xpBonus} XP Bonus
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
