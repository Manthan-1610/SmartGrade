/**
 * Signup page with role selection (Teacher/Student).
 * 
 * Features a multi-step form with role-specific fields and validation.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../lib/types';

type SignupStep = 'role' | 'form';

export default function Signup() {
  const navigate = useNavigate();
  const { signupTeacher, signupStudent, isLoading } = useAuth();
  
  const [step, setStep] = useState<SignupStep>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization_name: '',
    password: '',
    confirm_password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError('');
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setStep('form');
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Please enter your name');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Please enter your email');
      return false;
    }
    if (selectedRole === 'teacher' && !formData.organization_name.trim()) {
      setError('Please enter your organization name');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (!/[A-Z]/.test(formData.password)) {
      setError('Password must contain at least one uppercase letter');
      return false;
    }
    if (!/[a-z]/.test(formData.password)) {
      setError('Password must contain at least one lowercase letter');
      return false;
    }
    if (!/\d/.test(formData.password)) {
      setError('Password must contain at least one number');
      return false;
    }
    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    try {
      if (selectedRole === 'teacher') {
        await signupTeacher({
          name: formData.name,
          email: formData.email,
          organization_name: formData.organization_name,
          password: formData.password,
          confirm_password: formData.confirm_password,
        });
      } else {
        await signupStudent({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          confirm_password: formData.confirm_password,
        });
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed. Please try again.');
    }
  };

  const handleGoogleSignup = () => {
    setError('Google Sign-Up requires configuration. Please use email/password.');
  };

  return (
    <div className="min-h-screen flex bg-[#0a0a0f]">
      {/* Left side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-purple-600/10 to-fuchsia-600/20"></div>
        
        {/* Geometric patterns */}
        <div className="absolute inset-0">
          <div className="absolute top-32 left-16 w-48 h-48 border border-violet-500/20 rounded-full animate-pulse"></div>
          <div className="absolute top-60 left-32 w-64 h-64 border border-purple-500/20 rounded-3xl rotate-12"></div>
          <div className="absolute bottom-32 right-24 w-56 h-56 border border-fuchsia-500/20 rounded-2xl -rotate-12"></div>
          <div className="absolute bottom-48 right-48 w-40 h-40 bg-violet-500/5 rounded-full"></div>
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">SmartGrade</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
              Join the Future<br />of Education
            </h1>
            <p className="text-lg text-gray-400 max-w-md">
              Create your account and start transforming how you grade exams
              with AI-powered intelligence.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-violet-400 mb-1">50%</div>
              <div className="text-sm text-gray-400">Less grading time</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-purple-400 mb-1">99%</div>
              <div className="text-sm text-gray-400">OCR accuracy</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-fuchsia-400 mb-1">10k+</div>
              <div className="text-sm text-gray-400">Exams graded</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-pink-400 mb-1">4.9★</div>
              <div className="text-sm text-gray-400">Teacher rating</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Signup form */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">SmartGrade</span>
          </div>

          <div className="bg-[#12121a] border border-gray-800 rounded-2xl p-8 shadow-2xl">
            {step === 'role' ? (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-white mb-2">Create an account</h2>
                  <p className="text-gray-400">Choose how you'll use SmartGrade</p>
                </div>

                <div className="space-y-4 mb-6">
                  <button
                    onClick={() => handleRoleSelect('teacher')}
                    className="w-full p-5 bg-[#1a1a24] border-2 border-gray-700 rounded-xl hover:border-violet-500 hover:bg-violet-500/5 transition-all group text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white group-hover:text-violet-400 transition-colors">
                          I'm a Teacher
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">
                          Create exams, grade submissions, and provide feedback to students
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleRoleSelect('student')}
                    className="w-full p-5 bg-[#1a1a24] border-2 border-gray-700 rounded-xl hover:border-fuchsia-500 hover:bg-fuchsia-500/5 transition-all group text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-fuchsia-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M12 14l9-5-9-5-9 5 9 5z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white group-hover:text-fuchsia-400 transition-colors">
                          I'm a Student
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">
                          Submit exams and view your grades and feedback
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-[#12121a] text-gray-500">or continue with</span>
                  </div>
                </div>

                <button
                  onClick={handleGoogleSignup}
                  className="w-full py-3 bg-white text-gray-900 font-medium rounded-xl hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 focus:ring-offset-[#12121a] transition-all flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign up with Google
                </button>

                <p className="mt-8 text-center text-gray-400">
                  Already have an account?{' '}
                  <Link 
                    to="/login" 
                    className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
                  >
                    Sign in
                  </Link>
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={() => setStep('role')}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>

                <div className="text-center mb-8">
                  <div className={`w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center ${
                    selectedRole === 'teacher' 
                      ? 'bg-gradient-to-br from-violet-500 to-purple-600' 
                      : 'bg-gradient-to-br from-fuchsia-500 to-pink-600'
                  }`}>
                    {selectedRole === 'teacher' ? (
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    ) : (
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 14l9-5-9-5-9 5 9 5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                      </svg>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Create {selectedRole === 'teacher' ? 'Teacher' : 'Student'} Account
                  </h2>
                  <p className="text-gray-400">Fill in your details to get started</p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-red-400 text-sm flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {error}
                    </p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-[#1a1a24] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                      placeholder="John Doe"
                      autoComplete="name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-[#1a1a24] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>

                  {selectedRole === 'teacher' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Organization / School Name
                      </label>
                      <input
                        type="text"
                        name="organization_name"
                        value={formData.organization_name}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-[#1a1a24] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                        placeholder="Springfield High School"
                        autoComplete="organization"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-[#1a1a24] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all pr-12"
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Min 8 characters with uppercase, lowercase, and number
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirm_password"
                        value={formData.confirm_password}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-[#1a1a24] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all pr-12"
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {showConfirmPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3 text-white font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#12121a] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6 ${
                      selectedRole === 'teacher'
                        ? 'bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 focus:ring-violet-500'
                        : 'bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600 focus:ring-fuchsia-500'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </button>
                </form>

                <p className="mt-6 text-center text-gray-400 text-sm">
                  By creating an account, you agree to our{' '}
                  <a href="#" className="text-violet-400 hover:text-violet-300">Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" className="text-violet-400 hover:text-violet-300">Privacy Policy</a>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
