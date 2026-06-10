import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEffect } from 'react'
import { Zap, ArrowRight, CheckCircle, Brain, BarChart3, Shield } from 'lucide-react'

const features = [
  { icon: Brain, title: 'AI-Powered Analysis', desc: 'Advanced NLP and semantic matching using Hugging Face transformers', color: '#3b82f6' },
  { icon: BarChart3, title: 'Detailed Scoring', desc: 'Weighted scoring engine with core, secondary, and experience breakdown', color: '#8b5cf6' },
  { icon: CheckCircle, title: 'Skill Gap Detection', desc: 'Instantly see matched, missing, and extra skills vs job requirements', color: '#10b981' },
  { icon: Shield, title: 'ATS Simulation', desc: 'Simulates how Applicant Tracking Systems evaluate your resume', color: '#f59e0b' },
]

const stats = [
  { value: '95%', label: 'Accuracy Rate' },
  { value: '2s', label: 'Analysis Time' },
  { value: '10K+', label: 'Skills Database' },
  { value: 'GPT-4', label: 'AI Powered' },
]

export default function LandingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/upload')
  }, [user, navigate])

  return (
    <div>
      {/* Hero */}
      <div className="hero-bg" style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', padding: '60px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          {/* Badge */}
          <div className="animate-fade-up" style={{ animationDelay: '0ms', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 999, marginBottom: 32 }}>
            <Zap size={14} color="#3b82f6" />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#3b82f6' }}>AI-Powered ATS Resume Analyzer</span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up" style={{ animationDelay: '100ms', fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 24, color: '#f1f5f9' }}>
            Land Your Dream Job<br />
            <span className="gradient-text">Beat the ATS System</span>
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-up" style={{ animationDelay: '200ms', fontSize: 18, color: '#94a3b8', lineHeight: 1.7, maxWidth: 600, margin: '0 auto 40px', fontWeight: 400 }}>
            Upload your resume, paste a job description, and get an instant AI-powered match score with detailed skill gap analysis and personalized feedback.
          </p>

          {/* CTAs */}
          <div className="animate-fade-up" style={{ animationDelay: '300ms', display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Link to="/login" className="btn-primary" style={{ fontSize: 16, padding: '14px 32px' }}>
              Get Started Free <ArrowRight size={18} />
            </Link>
          </div>

          {/* Stats */}
          <div className="animate-fade-up" style={{ animationDelay: '400ms', display: 'flex', justifyContent: 'center', gap: 40, marginTop: 60, flexWrap: 'wrap' }}>
            {stats.map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 28, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{s.value}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 36, color: '#f1f5f9', marginBottom: 12 }}>
            Everything you need to <span className="gradient-text">get hired</span>
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 16 }}>Powered by state-of-the-art AI and NLP models</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {features.map((f, i) => (
            <div key={f.title} className="glass-card animate-fade-up" style={{ animationDelay: `${i * 100}ms`, padding: 28 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${f.color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <f.icon size={22} color={f.color} />
              </div>
              <h3 style={{ fontWeight: 600, fontSize: 16, color: '#f1f5f9', marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Banner */}
      <div style={{ padding: '0 24px 80px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 24, padding: '48px 40px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 30, color: '#f1f5f9', marginBottom: 12 }}>Ready to get your score?</h2>
          <p style={{ color: '#94a3b8', marginBottom: 28, fontSize: 15 }}>Sign in with Google and analyze your first resume in seconds.</p>
          <Link to="/login" className="btn-primary" style={{ fontSize: 15, padding: '13px 28px' }}>
            Start Analyzing <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  )
}
