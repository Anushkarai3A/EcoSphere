import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Edit3,
  Flame,
  GraduationCap,
  Hash,
  Loader2,
  Lock,
  Mail,
  Medal,
  Phone,
  Save,
  Shield,
  Sparkles,
  Trophy,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DisplayTitle, MetaRow, Rule, SectionHead } from "@/components/gallery";
import { AchievementCard } from "@/components/ecosphere/AchievementCard";
import { LevelBadge } from "@/components/ecosphere/LevelBadge";
import { XPBar } from "@/components/ecosphere/XPBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { studentApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/quests";
import type {
  StudentBadge,
  StudentDashboardMetrics,
  StudentProfileData,
  UpdateStudentProfileInput,
} from "@/lib/types";

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-micro text-[10px] uppercase tracking-[0.08em]";

export function StudentProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [allBadges, setAllBadges] = useState<StudentBadge[]>([]);
  const [metrics, setMetrics] = useState<StudentDashboardMetrics | null>(null);
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
      const [profRes, badgesRes, dashRes] = await Promise.all([
        studentApi.getProfile(),
        studentApi.getBadges().catch(() => ({ badges: [] })),
        // Read-only level / XP / rank readouts for the character sheet.
        studentApi.getDashboard().catch(() => null),
      ]);
      setProfile(profRes);
      setAllBadges(badgesRes.badges || []);
      setMetrics(dashRes?.metrics ?? null);
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

  // AchievementCard colours by badge.isEarned — merge the catalogue flag with
  // the per-user grants (userBadges) so locked / earned states stay accurate.
  const earnedByKey = new Map((profile?.userBadges ?? []).map((ub) => [ub.badge.key, ub.earnedAt]));
  const earnedCount = allBadges.filter(
    (b) => b.isEarned || earnedByKey.has(b.key),
  ).length;
  const displayBadges = allBadges.map((b) => {
    const grantedAt = earnedByKey.get(b.key);
    return {
      ...b,
      isEarned: Boolean(b.isEarned) || grantedAt !== undefined,
      earnedAt: b.earnedAt ?? grantedAt ?? undefined,
    } satisfies StudentBadge;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20">
        <Loader2 className="h-5 w-5 animate-spin text-emerald" aria-hidden />
        <p className="font-micro text-[11px] uppercase text-ash">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-5 pb-16 sm:px-10 animate-page-in">
      {/* Hero */}
      <section className="flex flex-col gap-4 pt-8 animate-gallery-rise">
        <MetaRow>
          <span>Character sheet</span>
          <span>{profile?.role ?? "Student"}</span>
          <span>{profile?.school?.name ?? "Ecosphere Institution"}</span>
        </MetaRow>
        <DisplayTitle lines={["MY", "PROFILE"]} />
        <p className="max-w-xl font-micro text-[11px] leading-[1.7] uppercase text-ash">
          Manage your academic details, view earned badges, and configure leaderboard privacy settings.
        </p>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-[2px] border border-destructive/40 px-3 py-2 font-micro text-[11px] uppercase text-destructive"
        >
          {error}
        </p>
      )}

      {successMsg && (
        <p
          role="status"
          className="rounded-[2px] border border-emerald/40 bg-emerald/10 px-3 py-2 font-micro text-[11px] uppercase text-emerald"
        >
          {successMsg}
        </p>
      )}

      {/* Identity panel */}
      <section className="glass-panel flex flex-col gap-7 rounded-[14px] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8 animate-gallery-rise">
        <div className="flex items-center gap-5">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-emerald/45 bg-[radial-gradient(circle_at_50%_30%,rgba(16,185,129,0.3),rgba(6,24,34,0.95)_70%)] shadow-[0_0_30px_-8px_rgba(16,185,129,0.8)]">
            <span aria-hidden className="absolute inset-1.5 rounded-full border border-frost/20" />
            <span className="font-title text-[26px] font-semibold text-bone">{initials}</span>
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-void bg-emerald animate-pulse-glow"
            />
          </div>

          <div className="min-w-0">
            <h2 className="font-display text-[28px] font-medium leading-tight tracking-tight text-bone">
              {profile?.firstName} {profile?.lastName}
            </h2>
            <p className="mt-1 break-all font-micro text-[11px] uppercase text-ash">{profile?.email}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`${chipBase} border-cyan/40 bg-cyan/10 text-cyan`}>
                {profile?.role ?? "STUDENT"}
              </span>
              <span className={`${chipBase} border-emerald/40 bg-emerald/10 text-emerald`}>
                <BadgeCheck className="h-3 w-3" aria-hidden />
                Verified student
              </span>
              {profile?.studentProfile?.streakCount !== undefined && (
                <span className={`${chipBase} border-gold/40 bg-gold/10 text-gold`}>
                  <Flame className="h-3 w-3" aria-hidden />
                  {profile.studentProfile.streakCount} day streak
                </span>
              )}
            </div>

            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-micro text-[10px] uppercase text-ash">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                {profile?.school?.name || "Ecosphere Institution"}
                {profile?.school?.city ? ` (${profile.school.city})` : ""}
              </span>
              {profile?.studentProfile?.department && (
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" aria-hidden />
                  {profile.studentProfile.department}
                  {profile.studentProfile.semester ? ` · Sem ${profile.studentProfile.semester}` : ""}
                </span>
              )}
            </p>
          </div>
        </div>

        {metrics ? (
          <LevelBadge level={metrics.level} className="mx-auto shrink-0 sm:mx-0" />
        ) : (
          <div className="mx-auto flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-full border border-frost/25 bg-white/[0.04] px-2 text-center sm:mx-0">
            <span className="font-micro text-[9px] uppercase tracking-[0.18em] text-ash">Level</span>
            <span className="font-title text-[22px] font-semibold leading-none text-ash">—</span>
          </div>
        )}
      </section>

      {/* XP + rank readouts */}
      <section className="glass-panel flex flex-col gap-6 rounded-[14px] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-micro text-[10px] uppercase tracking-[0.14em] text-emerald">Experience</p>
            <h2 className="mt-1.5 font-display text-[24px] font-medium leading-tight tracking-tight text-bone">
              XP &amp; standing
            </h2>
          </div>
          {metrics && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-micro text-[10px] uppercase tracking-[0.1em] text-gold">
              <Trophy className="h-3.5 w-3.5" aria-hidden />
              Rank #{metrics.leaderboardRank} of {metrics.totalStudentsInSchool}
            </span>
          )}
        </div>

        {metrics ? (
          <XPBar
            level={metrics.level}
            progress={metrics.levelProgress}
            target={metrics.levelTarget}
            totalXp={metrics.totalXp}
          />
        ) : (
          <p className="font-micro text-[11px] uppercase text-ash">
            Experience data unavailable right now.
          </p>
        )}

        <div className="grid grid-cols-3 gap-4 border-t border-frost/10 pt-5">
          <div>
            <p className="font-title text-[30px] font-semibold leading-none text-gold text-glow-gold">
              {metrics ? metrics.totalXp.toLocaleString() : "—"}
            </p>
            <p className="mt-2 font-micro text-[10px] uppercase tracking-[0.1em] text-ash">Total XP</p>
          </div>
          <div>
            <p className="font-title text-[30px] font-semibold leading-none text-bone">
              {metrics ? metrics.leaderboardRank : "—"}
            </p>
            <p className="mt-2 font-micro text-[10px] uppercase tracking-[0.1em] text-ash">Campus rank</p>
          </div>
          <div>
            <p className="font-title text-[30px] font-semibold leading-none text-bone">
              {earnedCount}
            </p>
            <p className="mt-2 font-micro text-[10px] uppercase tracking-[0.1em] text-ash">Badges</p>
          </div>
        </div>
      </section>

      {/* Stat grid */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CheckCircle2}
          label="Quests completed"
          value={metrics ? metrics.completedQuestsCount : "—"}
          tone="emerald"
        />
        <StatCard
          icon={Sparkles}
          label="XP earned"
          value={metrics ? metrics.totalXp.toLocaleString() : "—"}
          tone="sky"
        />
        <StatCard
          icon={Medal}
          label="Badges"
          value={`${earnedCount}/${allBadges.length}`}
          tone="amber"
        />
        <StatCard
          icon={Flame}
          label="Environmental actions"
          value={metrics ? metrics.completedQuestsCount + metrics.activeQuestsCount : "—"}
          sub="quests completed + active"
          tone="primary"
        />
      </section>

      <Rule />

      {/* Profile Details Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>Academic &amp; Personal Information</CardTitle>
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
              <User className="h-4 w-4 text-ash" aria-hidden />
              <div>
                <p className="font-micro text-[10px] uppercase text-ash">Full Name</p>
                <p className="text-sm font-normal">{profile?.firstName} {profile?.lastName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-ash" aria-hidden />
              <div>
                <p className="font-micro text-[10px] uppercase text-ash">Email Address</p>
                <p className="text-sm font-normal">{profile?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-ash" aria-hidden />
              <div>
                <p className="font-micro text-[10px] uppercase text-ash">Institution (Read-only)</p>
                <p className="text-sm font-normal text-bone">{profile?.school?.name ?? "Unassigned"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-ash" aria-hidden />
              <div>
                <p className="font-micro text-[10px] uppercase text-ash">Registered Since</p>
                <p className="text-sm font-normal">{profile?.createdAt ? formatDate(profile.createdAt) : "—"}</p>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-ash" aria-hidden />
              <div className="flex-1">
                <p className="font-micro text-[10px] uppercase text-ash">USN / Roll Number</p>
                {editing ? (
                  <Input
                    value={form.usn ?? ""}
                    onChange={(e) => setForm({ ...form, usn: e.target.value })}
                    placeholder="e.g. 1RV22CS001"
                    className="h-8 text-sm mt-1"
                  />
                ) : (
                  <p className="text-sm font-normal">{profile?.studentProfile?.usn ?? "Not provided"}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-ash" aria-hidden />
              <div className="flex-1">
                <p className="font-micro text-[10px] uppercase text-ash">Department / Major</p>
                {editing ? (
                  <Input
                    value={form.department ?? ""}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="e.g. Environmental Science"
                    className="h-8 text-sm mt-1"
                  />
                ) : (
                  <p className="text-sm font-normal">{profile?.studentProfile?.department ?? "Not provided"}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-ash" aria-hidden />
              <div className="flex-1">
                <p className="font-micro text-[10px] uppercase text-ash">Semester</p>
                {editing ? (
                  <Input
                    value={form.semester ?? ""}
                    onChange={(e) => setForm({ ...form, semester: e.target.value })}
                    placeholder="e.g. 5"
                    className="h-8 text-sm mt-1"
                  />
                ) : (
                  <p className="text-sm font-normal">{profile?.studentProfile?.semester ?? "Not provided"}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-ash" aria-hidden />
              <div className="flex-1">
                <p className="font-micro text-[10px] uppercase text-ash">Phone Number</p>
                {editing ? (
                  <Input
                    value={form.phone ?? ""}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="e.g. +91 9876543210"
                    className="h-8 text-sm mt-1"
                  />
                ) : (
                  <p className="text-sm font-normal">{profile?.studentProfile?.phone ?? "Not provided"}</p>
                )}
              </div>
            </div>
          </div>

          {/* Privacy Mode Option */}
          <div className="mt-6 border-t border-frost/15 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 font-micro text-[11px] uppercase text-bone">
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                  Privacy Mode (Leaderboard Anonymization)
                </p>
                <p className="mt-1 font-micro text-[10px] text-ash">
                  When enabled, your name will appear as "Anonymous Eco Scout" on the campus leaderboard.
                </p>
              </div>

              {editing ? (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.privacyMode ?? false}
                    onChange={(e) => setForm({ ...form, privacyMode: e.target.checked })}
                    className="h-4 w-4 accent-white"
                  />
                  <span className="ml-2 font-micro text-[10px] uppercase text-bone">Enable</span>
                </label>
              ) : (
                <span className="rounded-[2px] border border-frost/30 bg-white/[0.06] px-2 py-0.5 font-micro text-[10px] uppercase text-bone">
                  {profile?.studentProfile?.privacyMode ? "Active (Hidden)" : "Off (Visible)"}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          {editing && (
            <div className="mt-6 flex items-center gap-2 justify-end border-t border-frost/15 pt-4">
              <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
                <X className="h-4 w-4" aria-hidden />
                Cancel
              </Button>
              <Button size="sm" onClick={() => void onSave()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                Save Changes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Earned Badges Showcase */}
      <section className="flex flex-col gap-5">
        <SectionHead
          kicker="Milestones"
          title="Eco badges & achievements"
          right={
            <span className="font-micro text-[10px] uppercase tracking-[0.1em] text-gold">
              {earnedCount} / {allBadges.length} unlocked
            </span>
          }
        />
        <p className="max-w-xl font-micro text-[11px] uppercase leading-[1.7] text-ash">
          Badges earned through environmental action and academic milestones.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayBadges.map((badge) => (
            <AchievementCard key={badge.id} badge={badge} />
          ))}
        </div>
      </section>
    </div>
  );
}
