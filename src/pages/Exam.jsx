import { useState, useEffect, useRef } from 'react'
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import './Exam.css'
import ConfirmModal from '../components/ConfirmModal'
import TopBar from '../components/TopBar'
import Notification from '../components/Notification'

const EXAM_DURATION = 50 * 60 // 50 minutes in seconds
const COUNTDOWN_DURATION = 2 // 10 seconds countdown before exam starts

function Exam() {
  const [searchParams] = useSearchParams()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [examData, setExamData] = useState(null)
  const [error, setError] = useState(null)
  const [userInfo, setUserInfo] = useState(null)
  const [examId, setExamId] = useState(null)
  const [answers, setAnswers] = useState({}) // Store user's answers
  const [timeRemaining, setTimeRemaining] = useState(EXAM_DURATION)
  const [examStarted, setExamStarted] = useState(false)
  const [examStartTime, setExamStartTime] = useState(null)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [showNavigationModal, setShowNavigationModal] = useState(false)
  const [countdown, setCountdown] = useState(null) // Countdown before exam starts
  const [notification, setNotification] = useState(null) // {type, message}
  const [notified25Min, setNotified25Min] = useState(false)
  const [notified10Min, setNotified10Min] = useState(false)
  const [notified5Min, setNotified5Min] = useState(false)
  const [notified1Min, setNotified1Min] = useState(false)
  const hasLoadedRef = useRef(false)
  const isNavigatingAway = useRef(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Prevent multiple loads
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true

    const savedUser = localStorage.getItem('user')
    const savedUserInfo = localStorage.getItem('userInfo')

    if (savedUser) {
      const parsedUser = JSON.parse(savedUser)
      setUser(parsedUser)

      if (savedUserInfo) {
        setUserInfo(JSON.parse(savedUserInfo))
      }

      // Get exam ID from URL parameter
      const urlExamId = searchParams.get('id')

      // Load exam from session storage
      const currentExam = sessionStorage.getItem('currentExam')

      // Redirect to dashboard if no exam data or no exam ID in URL
      if (!currentExam || !urlExamId) {
        navigate('/dashboard')
        return
      }

      if (currentExam) {
        try {
          const examObj = JSON.parse(currentExam)

          // Verify exam ID matches URL parameter
          if (urlExamId && examObj.id.toString() === urlExamId) {
            setExamId(examObj.id)
            setExamData(examObj.data)

            // Debug: Check exam data structure
            console.log('Exam data loaded:', {
              hasReorderQuestions: !!examObj.data.reorder_questions,
              reorderCount: examObj.data.reorder_questions?.length || 0,
              hasFillShort: !!examObj.data.groups?.fill_short,
              fillShortCount: examObj.data.groups?.fill_short?.length || 0,
              hasFillLong: !!examObj.data.groups?.fill_long,
              fillLongCount: examObj.data.groups?.fill_long?.length || 0,
              hasReading: !!examObj.data.groups?.reading,
              readingCount: examObj.data.groups?.reading?.length || 0
            })

            // Restore saved state if exists
            const savedAnswers = sessionStorage.getItem('examAnswers')
            const savedStartTime = sessionStorage.getItem('examStartTime')
            const savedTimeRemaining = sessionStorage.getItem('examTimeRemaining')
            const savedExamStarted = sessionStorage.getItem('examStarted')

            if (savedAnswers) {
              setAnswers(JSON.parse(savedAnswers))
            }

            if (savedStartTime) {
              setExamStartTime(new Date(savedStartTime))
            } else {
              const startTime = new Date()
              setExamStartTime(startTime)
              sessionStorage.setItem('examStartTime', startTime.toISOString())
            }

            if (savedTimeRemaining) {
              setTimeRemaining(parseInt(savedTimeRemaining))
            }

            if (savedExamStarted === 'true') {
              setExamStarted(true)
            } else {
              // First time loading - show countdown
              setCountdown(COUNTDOWN_DURATION)
            }

            console.log('Exam loaded from session storage. ID:', examObj.id)
          } else {
            setError('Invalid exam ID or exam not found')
          }
        } catch (err) {
          console.error('Error loading exam from session storage:', err)
          setError('Failed to load exam data')
        }
      } else {
        setError('No exam data found. Please create a new exam.')
      }

      setLoading(false)
    } else {
      setLoading(false)
    }
  }, [searchParams])

  // Save answers to session storage whenever they change
  useEffect(() => {
    if (examStarted && Object.keys(answers).length > 0) {
      sessionStorage.setItem('examAnswers', JSON.stringify(answers))
    }
  }, [answers, examStarted])

  // Save time remaining to session storage
  useEffect(() => {
    if (examStarted) {
      sessionStorage.setItem('examTimeRemaining', timeRemaining.toString())
    }
  }, [timeRemaining, examStarted])

  // Save exam started state
  useEffect(() => {
    if (examStarted) {
      sessionStorage.setItem('examStarted', 'true')
    }
  }, [examStarted])

  // Timer countdown
  useEffect(() => {
    if (!examStarted || timeRemaining <= 0) return

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          // Auto-submit when time runs out
          clearExamStorage()
          navigate('/dashboard')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [examStarted, timeRemaining, navigate])

  // Countdown timer before exam starts
  useEffect(() => {
    if (countdown === null || countdown <= 0) return

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          setExamStarted(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [countdown])

  // Check for time milestone notifications
  useEffect(() => {
    if (!examStarted || timeRemaining <= 0) return

    const halfTime = EXAM_DURATION / 2 // 25 minutes for 50 min exam
    const oneFifthTime = EXAM_DURATION / 5 // 10 minutes for 50 min exam
    const oneTenthTime = EXAM_DURATION / 10 // 5 minutes for 50 min exam
    const oneMinute = 60 // 1 minute

    // Half time remaining notification (25 min for 50 min exam)
    if (!notified25Min && timeRemaining <= halfTime && timeRemaining > halfTime - 1) {
      const minutes = Math.floor(halfTime / 60)
      setNotification({
        type: 'info',
        message: `Còn lại ${minutes} phút để hoàn thành bài thi.`
      })
      setNotified25Min(true)
    }

    // 1/5 time remaining notification (10 min for 50 min exam)
    if (!notified10Min && timeRemaining <= oneFifthTime && timeRemaining > oneFifthTime - 1) {
      const minutes = Math.floor(oneFifthTime / 60)
      setNotification({
        type: 'warning',
        message: `Chỉ còn ${minutes} phút! Hãy kiểm tra lại các câu trả lời.`
      })
      setNotified10Min(true)
    }

    // 1/10 time remaining notification (5 min for 50 min exam)
    if (!notified5Min && timeRemaining <= oneTenthTime && timeRemaining > oneTenthTime - 1) {
      const minutes = Math.floor(oneTenthTime / 60)
      setNotification({
        type: 'warning',
        message: `Chỉ còn ${minutes} phút! Chuẩn bị nộp bài.`
      })
      setNotified5Min(true)
    }

    // 1 minute remaining notification
    if (!notified1Min && timeRemaining <= oneMinute && timeRemaining > oneMinute - 1) {
      setNotification({
        type: 'error',
        message: 'Chỉ còn 1 phút! Vui lòng nộp bài ngay.'
      })
      setNotified1Min(true)
    }
  }, [timeRemaining, examStarted, notified25Min, notified10Min, notified5Min, notified1Min])

  // Handle browser navigation (back/forward button, external navigation, tab close, refresh)
  useEffect(() => {
    const handlePopState = (e) => {
      if (examStarted && !isNavigatingAway.current) {
        e.preventDefault()
        // Push the state back to stay on current page
        window.history.pushState(null, '', window.location.pathname + window.location.search)
        setShowNavigationModal(true)

        // Prevent scroll restoration
        if (window.history.scrollRestoration) {
          window.history.scrollRestoration = 'manual'
        }

        // Keep scroll position
        window.scrollTo(0, 0)
      }
    }

    // Handle beforeunload (closing tab, refreshing, or typing new URL in address bar)
    // Note: Modern browsers only show generic message for security reasons
    const handleBeforeUnload = (e) => {
      if (examStarted && !isNavigatingAway.current) {
        e.preventDefault()
        e.returnValue = '' // Chrome requires returnValue to be set
        return '' // Some browsers require a return value
      }
    }

    // Intercept all link clicks to show custom modal
    const handleClick = (e) => {
      if (!examStarted || isNavigatingAway.current) return

      // Check if click is on a link or inside a link
      const link = e.target.closest('a')
      if (link && link.href) {
        const linkUrl = new URL(link.href)
        const currentUrl = new URL(window.location.href)

        // If link goes to different page (not same page anchor), show modal
        if (linkUrl.pathname !== currentUrl.pathname || linkUrl.search !== currentUrl.search) {
          e.preventDefault()
          e.stopPropagation()
          setShowNavigationModal(true)
        }
      }
    }

    // Push initial state when exam starts
    if (examStarted) {
      // Disable scroll restoration
      if (window.history.scrollRestoration) {
        window.history.scrollRestoration = 'manual'
      }

      window.history.pushState(null, '', window.location.pathname + window.location.search)
      window.addEventListener('popstate', handlePopState)
      window.addEventListener('beforeunload', handleBeforeUnload)
      document.addEventListener('click', handleClick, true) // Use capture phase
    }

    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleClick, true)
      // Restore default scroll restoration
      if (window.history.scrollRestoration) {
        window.history.scrollRestoration = 'auto'
      }
    }
  }, [examStarted])

  const clearExamStorage = () => {
    console.log('Clearing exam storage. Exam ID:', examId)
    sessionStorage.removeItem('currentExam')
    sessionStorage.removeItem('examAnswers')
    sessionStorage.removeItem('examStartTime')
    sessionStorage.removeItem('examTimeRemaining')
    sessionStorage.removeItem('examStarted')
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleAnswerSelect = (questionId, answer) => {
    setAnswers(prev => {
      // If clicking the same answer, unselect it
      if (prev[questionId] === answer) {
        const newAnswers = { ...prev }
        delete newAnswers[questionId]
        return newAnswers
      }
      // Otherwise, select the new answer
      return {
        ...prev,
        [questionId]: answer
      }
    })
  }

  const handleSubmitClick = () => {
    setShowSubmitModal(true)
  }

  const handleConfirmSubmit = () => {
    // Log exam ID before clearing storage
    console.log('=== EXAM SUBMITTED ===')
    console.log('Exam ID:', examId)
    console.log('Total answers:', Object.keys(answers).length)
    console.log('====================')

    // Set flag to allow navigation
    isNavigatingAway.current = true

    // Clear exam storage
    clearExamStorage()

    // Navigate to submission page with exam data and answers
    navigate('/submission', {
      state: {
        examData,
        answers,
        examStartTime
      }
    })
  }

  const handleExitClick = () => {
    setShowExitModal(true)
  }

  const handleConfirmExit = () => {
    // Log exam ID before clearing storage
    console.log('=== EXAM EXITED ===')
    console.log('Exam ID:', examId)
    console.log('User exited without submitting')
    console.log('===================')

    // Set flag to allow navigation
    isNavigatingAway.current = true

    // Clear exam storage
    clearExamStorage()

    navigate('/dashboard')
  }

  const handleConfirmNavigation = () => {
    // Log exam ID before clearing storage
    console.log('=== EXAM NAVIGATION AWAY ===')
    console.log('Exam ID:', examId)
    console.log('User navigated away without submitting')
    console.log('============================')

    // Set flag to allow navigation
    isNavigatingAway.current = true

    // Clear exam storage
    clearExamStorage()

    // Close modal and navigate back
    setShowNavigationModal(false)
    navigate('/dashboard')
  }

  const handleCancelNavigation = () => {
    setShowNavigationModal(false)
    // User chose to stay, do nothing
  }

  const formatDateTime = (date) => {
    if (!date) return ''
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${hours}:${minutes} - ${day}/${month}/${year}`
  }

  const scrollToQuestion = (questionNum) => {
    const element = document.getElementById(`question-${questionNum}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Build flat list of all questions for table of contents
  // Order matches extraction script: fill_short -> reorder -> fill_long -> reading
  const getAllQuestions = () => {
    if (!examData) return []

    const questions = []
    let questionNum = 1

    // Fill short groups (Questions 1-12)
    if (examData.groups.fill_short) {
      examData.groups.fill_short.forEach(group => {
        group.subquestions.forEach((_, subIdx) => {
          questions.push({
            num: questionNum++,
            id: `fill-short-${group.id}-${subIdx}`,
            type: 'fill_short'
          })
        })
      })
    }

    // Reorder questions (Questions 13-17)
    if (examData.reorder_questions) {
      examData.reorder_questions.forEach(q => {
        questions.push({
          num: questionNum++,
          id: `reorder-${q.id}`,
          type: 'reorder'
        })
      })
    }

    // Fill long groups (Questions 18-22)
    if (examData.groups.fill_long) {
      examData.groups.fill_long.forEach(group => {
        group.subquestions.forEach((_, subIdx) => {
          questions.push({
            num: questionNum++,
            id: `fill-long-${group.id}-${subIdx}`,
            type: 'fill_long'
          })
        })
      })
    }

    // Reading groups (Questions 23-40)
    if (examData.groups.reading) {
      examData.groups.reading.forEach(group => {
        group.subquestions.forEach((_, subIdx) => {
          questions.push({
            num: questionNum++,
            id: `reading-${group.id}-${subIdx}`,
            type: 'reading'
          })
        })
      })
    }

    return questions
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Đang tải đề thi...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  const allQuestions = getAllQuestions()

  return (
    <div className="exam-page">
      <TopBar userInfo={userInfo} hideLogout={true} />

      {/* Notification */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          duration={5000}
          onClose={() => setNotification(null)}
          position="top-right"
        />
      )}

      <main className="exam-main">
        {/* Countdown overlay */}
        {countdown !== null && countdown > 0 && (
          <div className="countdown-overlay">
            <div className="countdown-content">
              <h2>Bài thi sẽ bắt đầu sau</h2>
              <div className="countdown-timer">{countdown}</div>
              <p>Hãy chuẩn bị sẵn sàng!</p>
            </div>
          </div>
        )}

        {error ? (
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <h2>Không thể tải đề thi</h2>
            <p>{error}</p>
            <button onClick={() => navigate('/dashboard')} className="btn-back">
              Quay lại Dashboard
            </button>
          </div>
        ) : examData ? (
          <div className="exam-container">
            {/* Sidebar */}
            <aside className="exam-sidebar">
              <div className="sidebar-content">
                {/* Quiz Info */}
                <div className="sidebar-section">
                  <h3 className="sidebar-title">Thông tin đề thi</h3>
                  <div className="quiz-info">
                    <div className="quiz-info-item">
                      <span className="quiz-label">Mã đề:</span>
                      <span className="quiz-value">{examData.quiz_id}</span>
                    </div>
                    <div className="quiz-info-item">
                      <span className="quiz-label">Bắt đầu lúc:</span>
                      <span className="quiz-value">{formatDateTime(examStartTime)}</span>
                    </div>
                  </div>
                </div>

                {/* Timer */}
                <div className="sidebar-section">
                  <div className={`timer ${timeRemaining < 300 ? 'timer-warning' : ''}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span className="timer-text">{formatTime(timeRemaining)}</span>
                  </div>
                </div>

                {/* Table of Contents */}
                <div className="sidebar-section question-list-section">
                  <h3 className="sidebar-title">Danh sách câu hỏi</h3>
                  <div className="question-grid">
                    {allQuestions.map(q => (
                      <button
                        key={q.id}
                        onClick={() => scrollToQuestion(q.num)}
                        className={`question-btn ${answers[q.id] ? 'answered' : ''}`}
                      >
                        {q.num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            {/* Questions Content */}
            <div className="exam-content">
              {/* Fill Short Groups - Phần 1 (Questions 1-12) */}
              {examData.groups.fill_short && examData.groups.fill_short.length > 0 && (
                <div className="question-section">
                  <h2 className="section-title">
                    <span className="section-number">Phần 1</span>
                    Điền từ ngắn
                  </h2>
                  {examData.groups.fill_short.map((group, groupIdx) => {
                    let questionNum = 0

                    // Calculate question number offset
                    for (let i = 0; i < groupIdx; i++) {
                      questionNum += examData.groups.fill_short[i].subquestions.length
                    }

                    return (
                      <div key={group.id} className="question-group">
                        <div className="group-context">
                          <p className="context-text">{group.context}</p>
                        </div>
                        {group.subquestions.map((subq, subIdx) => {
                          const currentQuestionNum = questionNum + subIdx + 1
                          const questionId = `fill-short-${group.id}-${subIdx}`
                          return (
                            <div key={subIdx} id={`question-${currentQuestionNum}`} className="sub-question">
                              <div className="question-header">
                                <span className="question-number">Câu {currentQuestionNum}</span>
                              </div>
                              {subq.content && (
                                <p className="question-text">{subq.content}</p>
                              )}
                              <div className="options-list">
                                {subq.options.map((option, optIdx) => {
                                  const optionLetter = String.fromCharCode(65 + optIdx)
                                  return (
                                    <div
                                      key={optIdx}
                                      onClick={() => handleAnswerSelect(questionId, optionLetter)}
                                      className={`option-item ${answers[questionId] === optionLetter ? 'selected' : ''}`}
                                    >
                                      <span className="option-label">{optionLetter}.</span>
                                      <span className="option-text">{option}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Reorder Questions - Phần 2 (Questions 13-17) */}
              {examData.reorder_questions && examData.reorder_questions.length > 0 && (
                <div className="question-section">
                  <h2 className="section-title">
                    <span className="section-number">Phần 2</span>
                    Sắp xếp câu
                  </h2>
                  {examData.reorder_questions.map((question, idx) => {
                    const questionId = `reorder-${question.id}`
                    let questionNum = 0

                    // Add fill_short questions
                    if (examData.groups.fill_short) {
                      examData.groups.fill_short.forEach(g => {
                        questionNum += g.subquestions.length
                      })
                    }

                    questionNum += idx + 1

                    return (
                      <div key={question.id} id={`question-${questionNum}`} className="question-card">
                        <div className="question-header">
                          <span className="question-number">Câu {questionNum}</span>
                        </div>
                        {question.content && (
                          <p className="question-text">{question.content}</p>
                        )}
                        <div className="options-list">
                          {question.options && question.options.map((option, optIdx) => {
                            const optionLetter = String.fromCharCode(65 + optIdx)
                            return (
                              <div
                                key={optIdx}
                                onClick={() => handleAnswerSelect(questionId, optionLetter)}
                                className={`option-item ${answers[questionId] === optionLetter ? 'selected' : ''}`}
                              >
                                <span className="option-label">{optionLetter}.</span>
                                <span className="option-text">{option}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Fill Long Groups - Phần 3 (Questions 18-22) */}
              {examData.groups.fill_long && examData.groups.fill_long.length > 0 && (
                <div className="question-section">
                  <h2 className="section-title">
                    <span className="section-number">Phần 3</span>
                    Điền từ dài
                  </h2>
                  {examData.groups.fill_long.map((group, groupIdx) => {
                    let questionNum = 0

                    // Add fill_short questions
                    if (examData.groups.fill_short) {
                      examData.groups.fill_short.forEach(g => {
                        questionNum += g.subquestions.length
                      })
                    }

                    // Add reorder questions
                    if (examData.reorder_questions) {
                      questionNum += examData.reorder_questions.length
                    }

                    // Calculate question number offset for fill_long
                    for (let i = 0; i < groupIdx; i++) {
                      questionNum += examData.groups.fill_long[i].subquestions.length
                    }

                    return (
                      <div key={group.id} className="question-group">
                        <div className="group-context">
                          <p className="context-text">{group.context}</p>
                        </div>
                        {group.subquestions.map((subq, subIdx) => {
                          const currentQuestionNum = questionNum + subIdx + 1
                          const questionId = `fill-long-${group.id}-${subIdx}`
                          return (
                            <div key={subIdx} id={`question-${currentQuestionNum}`} className="sub-question">
                              <div className="question-header">
                                <span className="question-number">Câu {currentQuestionNum}</span>
                              </div>
                              {subq.content && (
                                <p className="question-text">{subq.content}</p>
                              )}
                              <div className="options-list">
                                {subq.options.map((option, optIdx) => {
                                  const optionLetter = String.fromCharCode(65 + optIdx)
                                  return (
                                    <div
                                      key={optIdx}
                                      onClick={() => handleAnswerSelect(questionId, optionLetter)}
                                      className={`option-item ${answers[questionId] === optionLetter ? 'selected' : ''}`}
                                    >
                                      <span className="option-label">{optionLetter}.</span>
                                      <span className="option-text">{option}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Reading Groups - Phần 4 (Questions 23-40) */}
              {examData.groups.reading && examData.groups.reading.length > 0 && (
                <div className="question-section">
                  <h2 className="section-title">
                    <span className="section-number">Phần 4</span>
                    Đọc hiểu
                  </h2>
                  {examData.groups.reading.map((group, groupIdx) => {
                    let questionNum = 0

                    // Add fill_short questions
                    if (examData.groups.fill_short) {
                      examData.groups.fill_short.forEach(g => {
                        questionNum += g.subquestions.length
                      })
                    }

                    // Add reorder questions
                    if (examData.reorder_questions) {
                      questionNum += examData.reorder_questions.length
                    }

                    // Add fill_long questions
                    if (examData.groups.fill_long) {
                      examData.groups.fill_long.forEach(g => {
                        questionNum += g.subquestions.length
                      })
                    }

                    // Calculate question number offset for reading
                    for (let i = 0; i < groupIdx; i++) {
                      questionNum += examData.groups.reading[i].subquestions.length
                    }

                    return (
                      <div key={group.id} className="question-group">
                        <div className="group-context reading-context">
                          <p className="context-text">{group.context}</p>
                        </div>
                        {group.subquestions.map((subq, subIdx) => {
                          const currentQuestionNum = questionNum + subIdx + 1
                          const questionId = `reading-${group.id}-${subIdx}`
                          return (
                            <div key={subIdx} id={`question-${currentQuestionNum}`} className="sub-question">
                              <div className="question-header">
                                <span className="question-number">Câu {currentQuestionNum}</span>
                              </div>
                              {subq.content && (
                                <p className="question-text">{subq.content}</p>
                              )}
                              <div className="options-list">
                                {subq.options.map((option, optIdx) => {
                                  const optionLetter = String.fromCharCode(65 + optIdx)
                                  return (
                                    <div
                                      key={optIdx}
                                      onClick={() => handleAnswerSelect(questionId, optionLetter)}
                                      className={`option-item ${answers[questionId] === optionLetter ? 'selected' : ''}`}
                                    >
                                      <span className="option-label">{optionLetter}.</span>
                                      <span className="option-text">{option}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Submit Button at end of exam */}
              <div className="exam-submit-section">
                <button onClick={handleSubmitClick} className="btn-submit-exam">
                  Nộp bài
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleConfirmSubmit}
        title="Nộp bài thi"
        message="Bạn có chắc chắn muốn nộp bài thi không? Bạn sẽ không thể thay đổi câu trả lời sau khi nộp bài."
        confirmText="Nộp bài"
        cancelText="Hủy"
        confirmStyle="primary"
      />

      <ConfirmModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onConfirm={handleConfirmExit}
        title="Thoát khỏi bài thi"
        message="Bạn có chắc chắn muốn thoát khỏi bài thi không? Tất cả câu trả lời của bạn sẽ không được lưu."
        confirmText="Thoát"
        cancelText="Ở lại"
        confirmStyle="danger"
      />

      <ConfirmModal
        isOpen={showNavigationModal}
        onClose={handleCancelNavigation}
        onConfirm={handleConfirmNavigation}
        title="Rời khỏi trang thi"
        message="Bạn đang trong bài thi. Nếu rời khỏi trang này, tất cả câu trả lời của bạn sẽ bị mất. Bạn có chắc chắn muốn tiếp tục không?"
        confirmText="Rời khỏi"
        cancelText="Ở lại"
        confirmStyle="danger"
      />
    </div>
  )
}

export default Exam
