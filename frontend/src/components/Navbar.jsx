import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { LogOut, FileText, History, Upload, Zap, Moon, Sun, Home } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Logged out successfully')
      navigate('/')
    } catch {
      toast.error('Error logging out')
    }
  }

  return (
    <nav className="navbar">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={18} color="white" />
          </div>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>
            Resume<span className="gradient-text">AI</span>
          </span>
        </Link>

        {/* Nav links */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(var(--overlay-rgb),0.05)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
              <Home size={15} /> Home
            </Link>
            <Link to="/upload" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(var(--overlay-rgb),0.05)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
              <Upload size={15} /> Analyze
            </Link>
            <Link to="/history" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(var(--overlay-rgb),0.05)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
              <History size={15} /> History
            </Link>
          </div>
        )}

        {/* User / Auth & Theme Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={toggleTheme} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: 'rgba(var(--overlay-rgb),0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(var(--overlay-rgb),0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'rgba(var(--overlay-rgb),0.05)' }}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {user.photo ? (
                  <img
                    src={user.photo}
                    alt={user.name || 'User'}
                    style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(59,130,246,0.4)', objectFit: 'cover' }}
                    onError={e => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                  display: user.photo ? 'none' : 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontWeight: 600, fontSize: 13, color: 'white',
                  flexShrink: 0,
                }}>
                  {(user.name?.[0] || user.email?.[0] || '?').toUpperCase()}
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{user.name?.split(' ')[0] || user.email?.split('@')[0]}</span>
              </div>
              <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(244,63,94,0.4)'; e.currentTarget.style.color = '#f43f5e' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
                <LogOut size={14} /> Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary" style={{ padding: '8px 20px', fontSize: 13 }}>Sign In</Link>
          )}
        </div>
      </div>
    </nav>
  )
}
