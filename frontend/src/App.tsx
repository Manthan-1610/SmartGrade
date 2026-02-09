/**
 * SmartGrade Application
 * 
 * AI-powered exam grading assistant for teachers.
 * Main entry point with React Router for navigation.
 */
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth, ProtectedRoute } from './contexts/AuthContext';
import { CreateExam } from '@/pages/CreateExam';
import { SubmitExam } from '@/pages/SubmitExam';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import { 
  GraduationCap, 
  FileText, 
  Upload, 
  ArrowRight, 
  Sparkles,
  Target,
  Users,
  LogOut,
  User
} from 'lucide-react';

// ============ Reusable Components ============

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="text-center p-6 animate-fade-in">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-bg-card rounded-2xl mb-4 shadow-lg">
        {icon}
      </div>
      <h3 className="font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">
        {description}
      </p>
    </div>
  );
}

interface ActionCardProps {
  onClick: () => void;
  icon: React.ReactNode;
  iconBgClass: string;
  hoverBorderClass: string;
  hoverTextClass: string;
  title: string;
  description: string;
  phase: string;
  phaseLabel: string;
}

function ActionCard({
  onClick,
  icon,
  iconBgClass,
  hoverBorderClass,
  hoverTextClass,
  title,
  description,
  phase,
  phaseLabel
}: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        group text-left rounded-2xl border border-border bg-bg-card p-8 
        shadow-lg transition-all duration-300
        hover:shadow-xl hover:scale-[1.02] ${hoverBorderClass}
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        focus:ring-offset-bg-primary
        animate-fade-in
      `}
    >
      <div className="flex items-start justify-between mb-6">
        <div className={`p-3 rounded-xl transition-colors ${iconBgClass}`}>
          {icon}
        </div>
        <ArrowRight 
          className={`w-6 h-6 text-text-muted transition-all group-hover:translate-x-1 ${hoverTextClass}`} 
          aria-hidden="true"
        />
      </div>
      
      <h2 className={`text-xl font-semibold mb-2 transition-colors ${hoverTextClass}`}>
        {title}
      </h2>
      <p className="text-text-secondary leading-relaxed">
        {description}
      </p>
      
      <div className="mt-6 flex items-center gap-3 text-sm text-text-muted">
        <span className="inline-flex items-center rounded-full px-3 py-1 bg-bg-secondary font-medium">
          {phase}
        </span>
        <span>{phaseLabel}</span>
      </div>
    </button>
  );
}

// ============ User Menu Component ============

function UserMenu() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium"
        >
          Sign In
        </button>
        <button
          onClick={() => navigate('/signup')}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all text-sm font-medium"
        >
          Sign Up
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
      <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg">
        <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="text-left hidden sm:block">
          <div className="text-sm font-medium text-white">{user?.name}</div>
          <div className="text-xs text-gray-400 capitalize">{user?.role}</div>
        </div>
      </div>
      <button
        onClick={() => {
          logout();
          navigate('/login');
        }}
        className="p-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
        title="Sign out"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  );
}

// ============ Home Page ============

function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* User Menu */}
      <UserMenu />

      {/* Hero Section */}
      <header className="relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/5" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-5xl mx-auto px-4 py-20 md:py-28">
          <div className="text-center">
            {/* Logo */}
            <div 
              className="
                inline-flex items-center justify-center w-20 h-20 
                bg-gradient-to-br from-primary to-primary-dark 
                rounded-2xl mb-8 shadow-xl shadow-primary/30
                animate-scale-in
              "
            >
              <GraduationCap className="w-10 h-10 text-white" aria-hidden="true" />
            </div>
            
            {/* Title */}
            <h1 className="text-4xl md:text-6xl font-bold mb-6 animate-fade-in">
              Smart<span className="text-primary">Grade</span>
            </h1>
            
            {/* Welcome message for logged in users */}
            {isAuthenticated && user && (
              <div className="mb-4 animate-fade-in">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  Welcome back, {user.name}!
                </span>
              </div>
            )}
            
            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-text-secondary mb-4 max-w-2xl mx-auto animate-fade-in stagger-1">
              AI-Powered Exam Grading Assistant
            </p>
            <p className="text-text-muted max-w-xl mx-auto animate-fade-in stagger-2">
              Digitize handwritten papers, generate intelligent rubrics, and grade 
              exams with semantic understanding—not just keyword matching.
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 pb-20">
        {/* Action Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 -mt-4" aria-label="Main actions">
          <ActionCard
            onClick={() => navigate('/create-exam')}
            icon={<FileText className="w-8 h-8 text-primary" />}
            iconBgClass="bg-primary/20 group-hover:bg-primary/30"
            hoverBorderClass="hover:border-primary"
            hoverTextClass="group-hover:text-primary"
            title="Create Exam Template"
            description="Define questions, marks, and ideal answers. Get AI-generated grading rubrics instantly."
            phase="Phase 1"
            phaseLabel="Template Engine"
          />

          <ActionCard
            onClick={() => navigate('/submit-exam')}
            icon={<Upload className="w-8 h-8 text-secondary" />}
            iconBgClass="bg-secondary/20 group-hover:bg-secondary/30"
            hoverBorderClass="hover:border-secondary"
            hoverTextClass="group-hover:text-secondary"
            title="Submit & Digitize"
            description="Upload handwritten answer sheets. AI extracts and transcribes student responses automatically."
            phase="Phase 2"
            phaseLabel="OCR & Digitization"
          />
        </section>

        {/* Features */}
        <section className="mt-20" aria-labelledby="features-heading">
          <h2 id="features-heading" className="sr-only">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <FeatureCard
              icon={<Target className="w-7 h-7 text-success" />}
              title="Semantic Understanding"
              description='Recognizes meaning, not just keywords. "Solar energy" equals "Power from the sun".'
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
        <footer className="mt-20 text-center text-sm text-text-muted">
          <p>
            SmartGrade v1.0 • Built for educators, powered by AI
          </p>
        </footer>
      </main>
    </div>
  );
}

// ============ Back Button Wrapper ============

function PageWithBackButton({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  
  return (
    <>
      <button
        onClick={() => navigate('/')}
        className="fixed top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium"
      >
        ← Home
      </button>
      <UserMenu />
      {children}
    </>
  );
}

// ============ App Router ============

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} 
      />
      <Route 
        path="/signup" 
        element={isAuthenticated ? <Navigate to="/" replace /> : <Signup />} 
      />
      
      {/* Home - accessible to all */}
      <Route path="/" element={<HomePage />} />
      
      {/* Protected routes - require authentication */}
      <Route 
        path="/create-exam" 
        element={
          <ProtectedRoute requiredRole="teacher">
            <PageWithBackButton>
              <CreateExam />
            </PageWithBackButton>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/submit-exam" 
        element={
          <ProtectedRoute>
            <PageWithBackButton>
              <SubmitExam />
            </PageWithBackButton>
          </ProtectedRoute>
        } 
      />
      
      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
