import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { FullPageLoader } from "@/components/FullPageLoader";
import { AuthProvider, useAuth } from "@/lib/auth";
import type { UserRole } from "@/lib/types";
import { AdminDashboardPage } from "@/pages/AdminDashboardPage";
import { TeacherDashboardPage } from "@/pages/TeacherDashboardPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { MapPage } from "@/pages/MapPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { StudentDashboardPage } from "@/pages/StudentDashboardPage";
import { StudentQuestsPage } from "@/pages/StudentQuestsPage";
import { StudentQuizzesPage } from "@/pages/StudentQuizzesPage";
import { TeacherQuestsPage } from "@/pages/TeacherQuestsPage";
import { TeacherQuizzesPage } from "@/pages/TeacherQuizzesPage";
import { TeacherReviewPage } from "@/pages/TeacherReviewPage";
import { TeacherProfilePage } from "@/pages/TeacherProfilePage";
import { TeacherAssignmentsPage } from "@/pages/TeacherAssignmentsPage";
import { CreateAssignmentPage } from "@/pages/CreateAssignmentPage";
import { TeacherAssignmentDetailPage } from "@/pages/TeacherAssignmentDetailPage";
import { StudentAssignmentsPage } from "@/pages/StudentAssignmentsPage";
import { StudentAssignmentDetailPage } from "@/pages/StudentAssignmentDetailPage";
import { StudentLeaderboardPage } from "@/pages/StudentLeaderboardPage";
import { StudentProfilePage } from "@/pages/StudentProfilePage";
import { AnimationStudioPage } from "@/pages/AnimationStudioPage";

function ProtectedLayout() {
  const { status } = useAuth();
  if (status === "loading") return <FullPageLoader />;
  if (status === "anonymous") return <Navigate to="/login" replace />;
  return <Outlet />;
}

function RequireRole({ roles }: { roles: UserRole[] }) {
  const { status, user } = useAuth();
  if (status === "loading") return <FullPageLoader />;
  if (status === "anonymous") return <Navigate to="/login" replace />;
  if (!user || !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function DashboardRedirect() {
  const { user } = useAuth();
  if (!user) return null;
  const target =
    user.role === "ADMIN" ? "/app/admin" : user.role === "TEACHER" ? "/app/teacher" : "/app/student-dashboard";
  return <Navigate to={target} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/app" element={<HomePage />} />
            <Route path="/dashboard" element={<DashboardRedirect />} />
            <Route element={<AppShell fluid />}>
              <Route path="/app/map" element={<MapPage />} />
            </Route>
            <Route element={<AppShell />}>
              <Route path="/app/student-dashboard" element={<StudentDashboardPage />} />
              <Route path="/app/student" element={<StudentQuestsPage />} />
              <Route element={<RequireRole roles={["ADMIN"]} />}>
                <Route path="/app/admin" element={<AdminDashboardPage />} />
              </Route>
              <Route element={<RequireRole roles={["TEACHER"]} />}>
                <Route path="/app/teacher" element={<TeacherDashboardPage />} />
                <Route path="/app/teacher/profile" element={<TeacherProfilePage />} />
                <Route path="/app/teacher/quests" element={<TeacherQuestsPage />} />
                <Route path="/app/teacher/assignments" element={<TeacherAssignmentsPage />} />
                <Route path="/app/teacher/assignments/create" element={<CreateAssignmentPage />} />
                <Route path="/app/teacher/assignments/:id" element={<TeacherAssignmentDetailPage />} />
                <Route path="/app/teacher/quizzes" element={<TeacherQuizzesPage />} />
                <Route path="/app/teacher/review" element={<TeacherReviewPage />} />
              </Route>
              <Route element={<RequireRole roles={["STUDENT"]} />}>
                <Route path="/app/student/assignments" element={<StudentAssignmentsPage />} />
                <Route path="/app/student/assignments/:id" element={<StudentAssignmentDetailPage />} />
                <Route path="/app/student/quizzes" element={<StudentQuizzesPage />} />
                <Route path="/app/student/animation-studio" element={<AnimationStudioPage />} />
                <Route path="/app/student/leaderboard" element={<StudentLeaderboardPage />} />
                <Route path="/app/student/profile" element={<StudentProfilePage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}