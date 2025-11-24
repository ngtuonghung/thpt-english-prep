import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import './App.css'
import Dashboard from './pages/Dashboard'
import Exam from './pages/Exam'
import Submission from './pages/Submission'
import ReviewQuiz from './pages/ReviewQuiz'

// API and Cognito config
const API_BASE = 'https://hrj5qc8u76.execute-api.ap-southeast-1.amazonaws.com/prod'
const COGNITO_DOMAIN = 'https://ap-southeast-1dmwikmffs.auth.ap-southeast-1.amazoncognito.com'
const CLIENT_ID = '4033t9pc3hhe7r84eq8mi2cnkj'
const SCOPE = 'email+openid+phone+profile'
const REDIRECT_URI = `${window.location.origin}/callback`

function CallbackHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    let didCancel = false

    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')

    if (code && !didCancel) {
      // Exchange code for tokens and get user info
      exchangeCodeForTokens(code)
    }

    return () => {
      didCancel = true
    }
  }, [navigate])

  const exchangeCodeForTokens = async (code) => {
    try {
      console.log('Exchanging code for tokens...')
      console.log('Code:', code)
      console.log('URL:', `${API_BASE}/token?code=${code}`)

      const response = await fetch(`${API_BASE}/token?code=${code}`)
      console.log('Response status:', response.status)

      const data = await response.json()
      console.log('Response data:', data)

      // Handle both Lambda Proxy (direct response) and non-proxy (wrapped in body)
      const body = data.body ? (typeof data.body === 'string' ? JSON.parse(data.body) : data.body) : data
      console.log('Parsed body:', body)

      if (body.access_token) {
        console.log('Got access token, storing...')
        // Store the tokens
        const user = {
          access_token: body.access_token,
          id_token: body.id_token,
          refresh_token: body.refresh_token,
          code: code
        }
        localStorage.setItem('user', JSON.stringify(user))
        navigate('/dashboard', { replace: true })
      } else {
        console.error('No access token received')
        console.error('Body:', body)
        navigate('/', { replace: true })
      }
    } catch (err) {
      console.error('Token exchange failed:', err)
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="loading">
      <div className="spinner"></div>
      <p>Đang xử lý đăng nhập...</p>
    </div>
  )
}

function Landing() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  
  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])
  
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Đang tải...</p>
      </div>
    )
  }
  
  // If logged in, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />
  }
  
  const handleLogin = async () => {
    try {
      const originParam = encodeURIComponent(window.location.origin)
      const timestamp = Date.now() // Cache buster
      console.log('Logging in from:', window.location.origin)
      console.log('Request URL:', `${API_BASE}/auth?origin=${originParam}&t=${timestamp}`)
      
      // Send origin as query parameter (API Gateway supports GET)
      const response = await fetch(`${API_BASE}/auth?origin=${originParam}&t=${timestamp}`)
      
      console.log('Response status:', response.status)
      const data = await response.json()
      console.log('Response data:', data)
      
      const body = typeof data.body === 'string' ? JSON.parse(data.body) : data.body
      console.log('Parsed body:', body)
      
      if (body.loginUrl) {
        console.log('Redirecting to:', body.loginUrl)
        window.location.href = body.loginUrl
      } else {
        console.error('No loginUrl in response')
      }
    } catch (err) {
      console.error('Login error:', err)
    }
  }
  
  const handleSignup = () => {
    const signupUrl = `${COGNITO_DOMAIN}/signup?client_id=${CLIENT_ID}&response_type=code&scope=${SCOPE}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
    window.location.href = signupUrl
  }

  return (
    <div className="landing">
      <div className="bg-animation">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <header className="hero">
        <div className="container">
          <nav className="navbar">
            <div className="logo">📚 THPT English Prep</div>
            <div className="nav-buttons">
              <button onClick={handleLogin} className="btn-text">Đăng nhập</button>
              <button onClick={handleSignup} className="btn-primary">Đăng ký ngay</button>
            </div>
          </nav>

          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title">Chinh phục <span className="highlight">Tiếng Anh THPT</span></h1>
              <p className="hero-description">Luyện thi theo đúng cấu trúc đề thi THPT Quốc Gia. Chấm điểm tự động bằng AI, phân tích chi tiết từng câu hỏi.</p>
              <div className="hero-actions">
                <button onClick={handleSignup} className="btn-hero-primary">Bắt đầu học ngay →</button>
                <button onClick={handleLogin} className="btn-hero-secondary">Đăng nhập</button>
              </div>
            </div>
            <div className="hero-features">
              <div className="floating-feature-card feature-card-1">
                <div className="feature-card-glow"></div>
                <div className="feature-card-icon">📝</div>
                <div className="feature-card-content">
                  <h4>Đề thi thực tế</h4>
                  <p>1,000+ đề thi THPT</p>
                </div>
                <div className="feature-card-badge">NEW</div>
              </div>
              <div className="floating-feature-card feature-card-2">
                <div className="feature-card-glow"></div>
                <div className="feature-card-icon">🤖</div>
                <div className="feature-card-content">
                  <h4>Chấm điểm AI</h4>
                  <p>Chính xác 99.5%</p>
                </div>
                <div className="feature-progress">
                  <div className="feature-progress-bar"></div>
                </div>
              </div>
              <div className="floating-feature-card feature-card-3">
                <div className="feature-card-glow"></div>
                <div className="feature-card-icon">👨‍🏫</div>
                <div className="feature-card-content">
                  <h4>Chatbot Giảng viên</h4>
                  <p>Hỗ trợ 24/7</p>
                </div>
              </div>
              <div className="floating-feature-card feature-card-4">
                <div className="feature-card-glow"></div>
                <div className="feature-card-icon">📊</div>
                <div className="feature-card-content">
                  <h4>Phân tích chi tiết</h4>
                  <p>Báo cáo thông minh</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-left">
              <div className="footer-logo">📚 THPT English Prep</div>
              <p>Nền tảng luyện thi Tiếng Anh THPT với công nghệ AI</p>
            </div>
            <div className="footer-right">
              © 2025 THPT English Prep
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/callback" element={<CallbackHandler />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/exam" element={<Exam />} />
        <Route path="/submission" element={<Submission />} />
        <Route path="/review-quiz" element={<ReviewQuiz />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
