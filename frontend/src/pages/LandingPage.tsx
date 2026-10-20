import { Link } from "react-router-dom";
import {
  BookOpenCheck,
  Trophy,
  Users,
  MapPinned,
  ChevronRight,
  ClipboardCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GameNavbar } from "@/components/ecosphere/GameNavbar";
import { WorldHero } from "@/components/ecosphere/WorldHero";
import { ExploreSection } from "@/components/ecosphere/ExploreSection";
import { DisplayTitle, MetaRow, SectionHead } from "@/components/gallery";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const features: { icon: LucideIcon; title: string; copy: string }[] = [
  {
    icon: MapPinned,
    title: "Real-world quests",
    copy: "Plant trees, clear coastlines and log biodiversity — quests tied to places on the map.",
  },
  {
    icon: Trophy,
    title: "XP, levels & badges",
    copy: "Every submission earns experience. Level up, unlock achievements and grow your streak.",
  },
  {
    icon: ClipboardCheck,
    title: "Assignments & quizzes",
    copy: "Teachers publish tasks and assessments; students complete them and track their progress.",
  },
  {
    icon: Users,
    title: "A living leaderboard",
    copy: "See who is leading the adventure this week and find your place among fellow explorers.",
  },
];

/** Public landing page — the visual identity of EcoSphere. */
export default function LandingPage() {
  const { user, status } = useAuth();
  const startHref = user ? (user.role === "TEACHER" ? "/app/teacher" : user.role === "ADMIN" ? "/app/admin" : "/app/map") : "/register";
  const loginHref = "/login";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-abyss text-bone">
      <GameNavbar />
      <main>
        <WorldHero />

        <ExploreSection />

        {/* FEATURES */}
        <section className="relative mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col gap-4">
            <MetaRow>
              <span>Adventure awaits</span>
              <span>Play the planet better</span>
            </MetaRow>
            <DisplayTitle lines={["Your quest log", "begins here"]} />
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, copy }) => (
              <article
                key={title}
                className="glass-panel group flex flex-col gap-4 rounded-[10px] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald/45"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald/40 bg-emerald/15 text-emerald transition-transform duration-300 group-hover:scale-110">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="font-display text-[18px] font-medium leading-tight text-bone">{title}</h3>
                <p className="text-[13px] leading-relaxed text-ash">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        {/* COMMUNITY */}
        <section
          id="community"
          className="relative mx-auto w-full max-w-7xl scroll-mt-20 px-5 pb-24 sm:px-8"
        >
          <div className="glass-strong relative overflow-hidden rounded-[20px] px-6 py-14 text-center sm:px-14">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(46,207,143,0.18),transparent_65%)]"
            />
            <div className="relative flex flex-col items-center gap-5">
              <SectionHead kicker="Community" title="Explorers wanted" className="items-center text-center" />
              <p className="max-w-xl text-[15px] leading-relaxed text-ash">
                EcoSphere is a school-wide environmental adventure. Join your classmates, take on quests and
                watch the map fill with your impact.
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
                <Link to={startHref}>
                  <Button size="lg">
                    {user ? "Open my dashboard" : "Start the adventure"}
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Button>
                </Link>
                {!user && status !== "loading" && (
                  <Link to={loginHref}>
                    <Button size="lg" variant="outline">
                      <BookOpenCheck className="h-4 w-4" aria-hidden />
                      I already have an account
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export { LandingPage };

/** Small helper kept for consistency with page-level class strings. */
export const landingSection = cn("mx-auto w-full max-w-7xl px-5 sm:px-8");
