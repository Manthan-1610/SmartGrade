/**
 * SmartGrade Application
 *
 * Main entry point with React Router.
 * Implements role-based routing: teachers and students see different
 * dashboards and pages; unauthenticated users see the landing page.
 */
import { lazy, Suspense, type ReactNode } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';
import { AuthProvider, useAuth, ProtectedRoute } from './contexts/AuthContext';
import {
  GraduationCap,
  FileText,
  Upload,
  ArrowRight,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

// ============ Lazy-Loaded Pages ============

// Auth
const Login = lazy(() => import('@/pages/Login'));
const Signup = lazy(() => import('@/pages/Signup'));

// Shared
const CreateExam = lazy(() =>
  import('@/pages/CreateExam').then((m) => ({ default: m.CreateExam })),
);
const SubmitExam = lazy(() =>
  import('@/pages/SubmitExam').then((m) => ({ default: m.SubmitExam })),
);

// Teacher
const TeacherDashboard = lazy(() => import('@/pages/teacher/TeacherDashboard'));
const ClassManagement = lazy(() => import('@/pages/teacher/ClassManagement'));
const ClassDetail = lazy(() => import('@/pages/teacher/ClassDetail'));
const ExamManagement = lazy(() => import('@/pages/teacher/ExamManagement'));
const EditExam = lazy(() => import('@/pages/teacher/EditExam'));
const GradingHub = lazy(() => import('@/pages/teacher/GradingHub'));
const GradingInterface = lazy(
  () => import('@/pages/teacher/GradingInterface'),
);

// Student
const StudentDashboard = lazy(() => import('@/pages/student/StudentDashboard'));
const Invitations = lazy(() => import('@/pages/student/Invitations'));
const Results = lazy(() => import('@/pages/student/Results'));

// ============ Suspense Fallback ============

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-text-secondary">Loading...</p>
      </div>
    </div>
  );
}

// ============ Landing Page ============

function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Top Bar */}
      <header className="fixed top-0 inset-x-0 z-50 bg-bg-primary/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-primary-dark rounded-xl">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-text-primary">SmartGrade</span>
          </div>

          {isAuthenticated ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
            >
              Go to Dashboard →
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-bg-hover transition-all text-sm font-medium"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                Get Started
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-28 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-secondary/5" />
        <div className="absolute top-10 left-1/4 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary to-primary-dark rounded-2xl mb-8 shadow-xl shadow-primary/30 animate-scale-in">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-6 animate-fade-in">
            Smart<span className="text-primary">Grade</span>
          </h1>

          {isAuthenticated && user && (
            <div className="mb-4 animate-fade-in">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 border border-success/20 rounded-full text-success text-sm">
                <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                Welcome back, {user.name}!
              </span>
            </div>
          )}

          <p className="text-xl md:text-2xl text-text-secondary mb-4 max-w-2xl mx-auto animate-fade-in stagger-1">
            AI-Powered Exam Grading Assistant
          </p>
          <p className="text-text-muted max-w-xl mx-auto animate-fade-in stagger-2">
            Digitize handwritten papers, generate intelligent rubrics, and grade
            exams with semantic understanding — not just keyword matching.
          </p>
        </div>
      </section>

      {/* Action Cards */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ActionCard
            onClick={() =>
              navigate(isAuthenticated ? '/create-exam' : '/signup')
            }
            icon={<FileText className="w-8 h-8 text-primary" />}
            accent="primary"
            title="Create Exam Template"
            description="Define questions, marks, and ideal answers. Get AI-generated grading rubrics instantly."
            tag="For Teachers"
          />
          <ActionCard
            onClick={() =>
              navigate(isAuthenticated ? '/submit-exam' : '/signup')
            }
            icon={<Upload className="w-8 h-8 text-secondary" />}
            accent="secondary"
            title="Submit & Digitize"
            description="Upload handwritten answer sheets. AI extracts and transcribes student responses automatically."
            tag="For Students"
          />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <FeatureCard
            icon={<Target className="w-7 h-7 text-success" />}
            title="Semantic Understanding"
            description={'"Solar energy" equals "Power from the sun". Recognizes meaning, not just keywords.'}
          />
          <FeatureCard
            icon={<Sparkles className="w-7 h-7 text-warning" />}
            title="Handwriting OCR"
            description="Advanced AI reads student handwriting with high accuracy and confidence scoring."
          />
          <FeatureCard
            icon={<Users className="w-7 h-7 text-primary" />}
            title="Teacher Control"
            description="Review, verify, and override AI suggestions. You're always in control of final grades."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-text-muted">
        SmartGrade v1.0 · Built for educators, powered by AI
      </footer>
    </div>
  );
}

// ============ Small UI Components ============

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center p-6 animate-fade-in">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-bg-card rounded-2xl mb-4 shadow-lg">
        {icon}
      </div>
      <h3 className="font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
    </div>
  );
}

function ActionCard({
  onClick,
  icon,
  accent,
  title,
  description,
  tag,
}: {
  onClick: () => void;
  icon: ReactNode;
  accent: 'primary' | 'secondary';
  title: string;
  description: string;
  tag: string;
}) {
  const borderHover = accent === 'primary' ? 'hover:border-primary' : 'hover:border-secondary';
  const textHover = accent === 'primary' ? 'group-hover:text-primary' : 'group-hover:text-secondary';
  const iconBg = accent === 'primary' ? 'bg-primary/20 group-hover:bg-primary/30' : 'bg-secondary/20 group-hover:bg-secondary/30';

  return (
    <button
      onClick={onClick}
      className={`group text-left rounded-2xl border border-border bg-bg-card p-8 shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${borderHover} focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg-primary animate-fade-in`}
    >
      <div className="flex items-start justify-between mb-6">
        <div className={`p-3 rounded-xl transition-colors ${iconBg}`}>{icon}</div>
        <ArrowRight className={`w-6 h-6 text-text-muted transition-all group-hover:translate-x-1 ${textHover}`} />
      </div>
      <h2 className={`text-xl font-semibold mb-2 transition-colors ${textHover}`}>{title}</h2>
      <p className="text-text-secondary leading-relaxed">{description}</p>
      <div className="mt-6">
        <span className="inline-flex items-center rounded-full px-3 py-1 bg-bg-secondary text-sm font-medium text-text-muted">
          {tag}
        </span>
      </div>
    </button>
  );
}

// ============ Dashboard Redirect ============

/**
 * Redirects /dashboard to the correct role-specific dashboard.
 */
function DashboardRedirect() {
  const { isTeacher } = useAuth();
  // Both roles use /dashboard; the DashboardLayout shows role-specific nav.
  // We render the correct page component based on role.
  return isTeacher ? <TeacherDashboard /> : <StudentDashboard />;
}

// ============ App Routes ============

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ---------- Public ---------- */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
        />
        <Route
          path="/signup"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Signup />}
        />

        {/* Landing page */}
        <Route path="/" element={<LandingPage />} />

        {/* ---------- Protected: Any Authenticated User ---------- */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardRedirect />
            </ProtectedRoute>
          }
        />

        {/* ---------- Teacher Routes ---------- */}
        <Route
          path="/classes"
          element={
            <ProtectedRoute requiredRole="teacher">
              <ClassManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/classes/:classId"
          element={
            <ProtectedRoute requiredRole="teacher">
              <ClassDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-exam"
          element={
            <ProtectedRoute requiredRole="teacher">
              <CreateExam />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exams"
          element={
            <ProtectedRoute requiredRole="teacher">
              <ExamManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exams/:examId/edit"
          element={
            <ProtectedRoute requiredRole="teacher">
              <EditExam />
            </ProtectedRoute>
          }
        />
        <Route
          path="/grading"
          element={
            <ProtectedRoute requiredRole="teacher">
              <GradingHub />
            </ProtectedRoute>
          }
        />
        <Route
          path="/grading/:examId"
          element={
            <ProtectedRoute requiredRole="teacher">
              <GradingInterface />
            </ProtectedRoute>
          }
        />

        {/* ---------- Student Routes ---------- */}
        <Route
          path="/submit-exam"
          element={
            <ProtectedRoute requiredRole="student">
              <SubmitExam />
            </ProtectedRoute>
          }
        />
        <Route
          path="/submit-exam/:examId"
          element={
            <ProtectedRoute requiredRole="student">
              <SubmitExam />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-classes"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invitations"
          element={
            <ProtectedRoute requiredRole="student">
              <Invitations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results"
          element={
            <ProtectedRoute requiredRole="student">
              <Results />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results/:examId"
          element={
            <ProtectedRoute requiredRole="student">
              <Results />
            </ProtectedRoute>
          }
        />

        {/* ---------- Catch-All ---------- */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

// ============ Main App ============

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
