import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import Notification from '../components/Notification'
import TopBar from '../components/TopBar'
import './Dashboard.css'

const API_BASE = 'https://hrj5qc8u76.execute-api.ap-southeast-1.amazonaws.com/prod'

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchingUserInfo, setFetchingUserInfo] = useState(true)
  const [userInfo, setUserInfo] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [creatingExam, setCreatingExam] = useState(false)
  const fetchingRef = useRef(false)
  const hasFetchedRef = useRef(false)
  const fileInputRef = useRef(null)

  const fetchUserInfo = useCallback(async (accessToken) => {
    // Prevent duplicate fetches
    if (fetchingRef.current || hasFetchedRef.current) {
      console.log('Skipping duplicate fetch request')
      return
    }

    fetchingRef.current = true
    setFetchingUserInfo(true)

    try {
      console.log('Fetching user info...')
      const response = await fetch(`${API_BASE}/user`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      console.log('User info response status:', response.status)

      const data = await response.json()
      console.log('User info data:', data)

      // Handle both Lambda Proxy (direct response) and non-proxy (wrapped in body)
      const body = data.body ? (typeof data.body === 'string' ? JSON.parse(data.body) : data.body) : data
      console.log('User info parsed:', body)
      console.log('User groups:', body.groups)
      console.log('Is admin?', body.groups?.includes('admin'))

      setUserInfo(body)
      // Save user info to localStorage for future sessions
      localStorage.setItem('userInfo', JSON.stringify(body))
      hasFetchedRef.current = true
    } catch (err) {
      console.error('Failed to fetch user info:', err)
    } finally {
      fetchingRef.current = false
      setFetchingUserInfo(false)
    }
  }, [])

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    const savedUserInfo = localStorage.getItem('userInfo')

    if (savedUser) {
      const parsedUser = JSON.parse(savedUser)
      setUser(parsedUser)

      // Check if we have cached user info
      if (savedUserInfo) {
        // Use cached user info
        const parsedUserInfo = JSON.parse(savedUserInfo)
        setUserInfo(parsedUserInfo)
        setFetchingUserInfo(false)
        hasFetchedRef.current = true
        console.log('Using cached user info')
      } else if (parsedUser.access_token) {
        // Fetch user info from API only if not cached
        fetchUserInfo(parsedUser.access_token)
      }
    }
    setLoading(false)
  }, [fetchUserInfo])

  const handleFileSelect = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validate file type
    if (file.type !== 'application/pdf') {
      setUploadStatus({ type: 'error', message: 'Vui lòng chọn tệp PDF' })
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadStatus({ type: 'error', message: 'Kích thước tệp phải nhỏ hơn 10MB' })
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setUploadStatus(null)

    try {
      // Stage 1: Validation (0-10%)
      console.log('Validating file...')
      setUploadProgress(10)

      // Stage 2: Base64 conversion (10-30%)
      console.log('Converting PDF to base64...')
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const base64String = reader.result.split(',')[1]
          resolve(base64String)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      setUploadProgress(30)

      // Stage 3: Uploading to server (30-70%)
      console.log('Uploading PDF to API...')

      // Use XMLHttpRequest for progress tracking
      const uploadPromise = new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = 30 + (e.loaded / e.total) * 40
            setUploadProgress(Math.round(percentComplete))
          }
        })

        xhr.addEventListener('load', () => {
          // Stage 4: Processing on server (70-100%)
          setUploadProgress(70)
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText)
              resolve({ ok: true, status: xhr.status, data })
            } catch (e) {
              reject(new Error('Invalid response format'))
            }
          } else {
            try {
              const data = JSON.parse(xhr.responseText)
              resolve({ ok: false, status: xhr.status, data })
            } catch (e) {
              reject(new Error(`Upload failed with status ${xhr.status}`))
            }
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Network error occurred'))
        })

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'))
        })

        xhr.open('POST', `${API_BASE}/upload`)
        xhr.setRequestHeader('Content-Type', 'application/json')
        xhr.setRequestHeader('Authorization', `Bearer ${user.access_token}`)
        xhr.send(JSON.stringify({ file: base64 }))
      })

      const response = await uploadPromise

      console.log('Upload response status:', response.status)
      console.log('Upload response data:', response.data)

      if (response.ok) {
        // Complete processing stage (70-100%)
        setUploadProgress(100)

        setUploadStatus({
          type: 'success',
          message: `Tải lên thành công! Đã trích xuất ${response.data.questions || 0} câu hỏi.`
        })
      } else {
        setUploadStatus({
          type: 'error',
          message: response.data.message || 'Tải lên thất bại. Vui lòng thử lại.'
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus({
        type: 'error',
        message: error.message || 'Không thể tải lên tệp. Vui lòng kiểm tra kết nối và thử lại.'
      })
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleReviewQuiz = () => {
    navigate('/review-quiz')
  }

  const handleCreateExam = async () => {
    setCreatingExam(true)

    try {
      console.log('Fetching exam questions from /exam endpoint...')

      const response = await fetch(`${API_BASE}/exam`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('Response status:', response.status)

      if (response.status === 404) {
        try {
            const errorData = await response.json();
            const body = errorData.body ? (typeof errorData.body === 'string' ? JSON.parse(errorData.body) : errorData.body) : errorData;
            setUploadStatus({
                type: 'info',
                message: body.message || 'Không có câu hỏi nào trong cơ sở dữ liệu để tạo đề thi.'
            });
        } catch (e) {
            setUploadStatus({
                type: 'info',
                message: 'Không có câu hỏi nào trong cơ sở dữ liệu để tạo đề thi.'
            });
        }
        return; 
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Raw response data:', data)

      // Handle both Lambda Proxy (direct response) and non-proxy (wrapped in body)
      const body = data.body ? (typeof data.body === 'string' ? JSON.parse(data.body) : data.body) : data

      console.log('===== EXAM QUESTIONS =====')
      console.log('Quiz ID:', body.quiz_id)
      console.log('Structure:', body.structure)
      console.log('Fill Short Groups:', body.groups.fill_short)
      console.log('Fill Long Groups:', body.groups.fill_long)
      console.log('Reading Groups:', body.groups.reading)
      console.log('Reorder Questions:', body.reorder_questions)
      console.log('===========================')

      // Use the quiz_id from the backend as the unique exam ID
      const examId = body.quiz_id

      // Clear any existing exam data from session storage
      sessionStorage.removeItem('currentExam')
      sessionStorage.removeItem('examAnswers')
      sessionStorage.removeItem('examStartTime')
      sessionStorage.removeItem('examTimeRemaining')
      sessionStorage.removeItem('examDoing')
      sessionStorage.removeItem('submissionResult')

      // Save exam data to session storage
      sessionStorage.setItem('currentExam', JSON.stringify({
        id: examId,
        data: body
      }))
      
      // Initialize examDoing to true for new exam
      sessionStorage.setItem('examDoing', 'true')

      console.log('Exam created with ID:', examId)

      // Navigate to exam page with exam ID
      navigate(`/exam?id=${examId}`)

    } catch (error) {
      console.error('Error fetching exam:', error)
      setUploadStatus({
        type: 'error',
        message: error.message || 'Không thể tạo đề thi. Vui lòng thử lại.'
      })
    } finally {
      setCreatingExam(false)
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Đang tải...</p>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/" replace />
  }
  
  return (
    <div className="dashboard">
      <TopBar userInfo={userInfo} />
      
      <main className="dashboard-main">
        <div className="container">
          <div className="dashboard-welcome">
            <h1 className="dashboard-title">Chào mừng trở lại, <span className="highlight-name">{userInfo?.username || userInfo?.email?.split('@')[0] || 'bạn'}</span>! 👋</h1>
            <p className="dashboard-subtitle">Hãy tiếp tục hành trình chinh phục Tiếng Anh THPT của bạn</p>
          </div>

          {/* Actions */}
          <div className="actions-container">
            <div className="action-card-modern">
              <div className="action-card-content">
                <div className="action-card-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 6v6l4 2"></path>
                  </svg>
                </div>
                <div className="action-card-text">
                  <h3 className="action-card-title">Ôn tập nhanh</h3>
                  <p className="action-card-description">Sinh 5 câu hỏi review dựa trên lịch sử trả lời sai</p>
                </div>
              </div>
              <button
                className="btn-action-modern"
                onClick={handleReviewQuiz}
              >
                <span>Bắt đầu ôn tập</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>

            <div className="action-card-modern">
              <div className="action-card-content">
                <div className="action-card-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </div>
                <div className="action-card-text">
                  <h3 className="action-card-title">Tạo đề thi</h3>
                  <p className="action-card-description">Bắt đầu tạo đề thi mới cho học sinh của bạn</p>
                </div>
              </div>
              <button
                className="btn-action-modern"
                onClick={handleCreateExam}
                disabled={creatingExam}
              >
                {creatingExam ? (
                  <>
                    <svg className="upload-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                    <span>Đang tạo...</span>
                  </>
                ) : (
                  <>
                    <span>Bắt đầu</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </>
                )}
              </button>
            </div>

            {/* Upload PDF - Admin only */}
            {userInfo?.groups?.includes('admin') && (
              <div className="action-card-modern">
                <div className="action-card-content">
                  <div className="action-card-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                  </div>
                  <div className="action-card-text">
                    <h3 className="action-card-title">Tải lên PDF (Chỉ quản trị viên)</h3>
                    <p className="action-card-description">Tải lên tài liệu và đề thi</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                {uploading && (
                  <div className="upload-progress-container">
                    <div className="upload-progress-bar">
                      <div
                        className="upload-progress-fill"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <div className="upload-progress-text">
                      <span>Đang tải lên...</span>
                      <span className="upload-progress-percent">{uploadProgress}%</span>
                    </div>
                  </div>
                )}
                <button
                  className="btn-action-modern"
                  onClick={handleUploadClick}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <svg className="upload-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                      </svg>
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <>
                      <span>Tải lên</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Loading overlay when fetching user info */}
      {fetchingUserInfo && (
        <div className="loading-overlay">
          <div className="loading-overlay-content">
            <div className="spinner"></div>
            <p>Đang tải thông tin người dùng...</p>
          </div>
        </div>
      )}

      {/* Notification popup */}
      {uploadStatus && (
        <Notification
          type={uploadStatus.type}
          message={uploadStatus.message}
          duration={5000}
          onClose={() => setUploadStatus(null)}
          position="top-right"
        />
      )}
    </div>
  )
}
