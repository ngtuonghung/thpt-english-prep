import { useState, useEffect, useRef } from 'react'
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import './Exam.css'
import ConfirmModal from '../components/ConfirmModal'
import TopBar from '../components/TopBar'
import Notification from '../components/Notification'
import QuestionsList from '../components/QuestionsList'

const EXAM_DURATION = 50 * 60 // 50 minutes in seconds
const COUNTDOWN_DURATION = 3 // 10 seconds countdown before exam starts

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
  const [examDoing, setExamDoing] = useState(false)
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
      const savedExamDoing = sessionStorage.getItem('examDoing')

      // Redirect to dashboard only if examDoing is explicitly false (exam finished)
      if (savedExamDoing === 'false') {
        // Clean up session storage
        sessionStorage.removeItem('currentExam')
        sessionStorage.removeItem('examAnswers')
        sessionStorage.removeItem('examStartTime')
        sessionStorage.removeItem('examDoing')
        navigate('/dashboard')
        return
      }

      // Redirect if no exam data or exam ID
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
            const savedExamDoing = sessionStorage.getItem('examDoing')

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

            if (savedExamDoing === 'true') {
              setExamDoing(true)
              // Restore time remaining only if exam is doing
              const savedTimeRemaining = sessionStorage.getItem('examTimeRemaining')
              if (savedTimeRemaining) {
                setTimeRemaining(parseInt(savedTimeRemaining))
              }
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
    if (examDoing && Object.keys(answers).length > 0) {
      sessionStorage.setItem('examAnswers', JSON.stringify(answers))
    }
  }, [answers, examDoing])

  // Save time remaining to session storage
  useEffect(() => {
    if (examDoing) {
      sessionStorage.setItem('examTimeRemaining', timeRemaining.toString())
    }
  }, [timeRemaining, examDoing])

  // Save exam doing state
  useEffect(() => {
    sessionStorage.setItem('examDoing', examDoing.toString())
  }, [examDoing])

  // Timer countdown
  useEffect(() => {
    if (!examDoing || timeRemaining <= 0) return

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          // Auto-submit when time runs out
          sessionStorage.setItem('examDoing', 'false')
          sessionStorage.removeItem('examTimeRemaining')
          navigate('/dashboard')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [examDoing, timeRemaining, navigate])

  // Countdown timer before exam starts
  useEffect(() => {
    if (countdown === null || countdown <= 0) return

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          setExamDoing(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [countdown])

  // Check for time milestone notifications
  useEffect(() => {
    if (!examDoing || timeRemaining <= 0) return

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
  }, [timeRemaining, examDoing, notified25Min, notified10Min, notified5Min, notified1Min])

  // Handle browser navigation (back/forward button, external navigation, tab close, refresh)
  useEffect(() => {
    // Handle popstate (back/forward button)
    const handlePopState = (e) => {
      if (examDoing && !isNavigatingAway.current) {
        e.preventDefault()
        e.stopPropagation()
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
    const handleBeforeUnload = (e) => {
      if (examDoing && !isNavigatingAway.current) {
        e.preventDefault()
        e.returnValue = 'Bạn đang trong bài thi. Nếu rời khỏi trang này, tất cả câu trả lời của bạn sẽ bị mất.'
        return e.returnValue
      }
    }

    // Handle unload (when page is actually closing)
    const handleUnload = (e) => {
      if (examDoing && !isNavigatingAway.current) {
        // Log the exit
        console.log('=== PAGE CLOSED/REFRESHED DURING EXAM ===')
        console.log('Exam ID:', examId)
      }
    }

    // Intercept all link clicks to show custom modal
    const handleClick = (e) => {
      if (!examDoing || isNavigatingAway.current) return

      // Check if click is on a link or inside a link
      const link = e.target.closest('a')
      if (link && link.href) {
        try {
          const linkUrl = new URL(link.href)
          const currentUrl = new URL(window.location.href)

          // If link goes to different page (not same page anchor), show modal
          if (linkUrl.pathname !== currentUrl.pathname || 
              linkUrl.search !== currentUrl.search || 
              linkUrl.origin !== currentUrl.origin) {
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
            setShowNavigationModal(true)
          }
        } catch (err) {
          // If URL parsing fails, block navigation to be safe
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          setShowNavigationModal(true)
        }
      }
    }

    // Intercept form submissions
    const handleSubmit = (e) => {
      if (examDoing && !isNavigatingAway.current) {
        const form = e.target
        if (form && form.tagName === 'FORM') {
          // Check if it's not our own form
          const isOwnForm = form.closest('.exam-page')
          if (!isOwnForm) {
            e.preventDefault()
            e.stopPropagation()
            setShowNavigationModal(true)
          }
        }
      }
    }

    // Push initial state when exam starts
    if (examDoing) {
      // Disable scroll restoration
      if (window.history.scrollRestoration) {
        window.history.scrollRestoration = 'manual'
      }

      // Push multiple states to make it harder to navigate away accidentally
      window.history.pushState(null, '', window.location.pathname + window.location.search)
      
      // Add event listeners
      window.addEventListener('popstate', handlePopState)
      window.addEventListener('beforeunload', handleBeforeUnload)
      window.addEventListener('unload', handleUnload)
      document.addEventListener('click', handleClick, true) // Use capture phase
      document.addEventListener('submit', handleSubmit, true) // Capture form submissions

      // Periodically push state to maintain history lock
      const historyInterval = setInterval(() => {
        if (examDoing && !isNavigatingAway.current) {
          window.history.pushState(null, '', window.location.pathname + window.location.search)
        }
      }, 500)

      return () => {
        clearInterval(historyInterval)
        window.removeEventListener('popstate', handlePopState)
        window.removeEventListener('beforeunload', handleBeforeUnload)
        window.removeEventListener('unload', handleUnload)
        document.removeEventListener('click', handleClick, true)
        document.removeEventListener('submit', handleSubmit, true)
        // Restore default scroll restoration
        if (window.history.scrollRestoration) {
          window.history.scrollRestoration = 'auto'
        }
      }
    }
  }, [examDoing, examId])

  const clearExamStorage = () => {
    console.log('Clearing exam storage. Exam ID:', examId)
    sessionStorage.removeItem('currentExam')
    sessionStorage.removeItem('examAnswers')
    sessionStorage.removeItem('examStartTime')
    sessionStorage.removeItem('examDoing')
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

  const handleConfirmSubmit = async () => {
    console.log('=== EXAM SUBMITTING... ===')
    setShowSubmitModal(false) // Close modal immediately

    try {
      const response = await fetch(`${'https://hrj5qc8u76.execute-api.ap-southeast-1.amazonaws.com/prod'}/submission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.access_token}`,
        },
        body: JSON.stringify({
          user_id: userInfo.sub,
          examData,
          answers,
          examStartTime,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Submission failed on the server')
      }

      const result = await response.json()
      console.log('Submission successful:', result)

      // Set examDoing to false and remove examTimeRemaining
      sessionStorage.setItem('examDoing', 'false')
      sessionStorage.removeItem('examTimeRemaining')

      // Set flag to allow navigation
      isNavigatingAway.current = true

      // Navigate to submission page with exam data and answers
      navigate('/submission', {
        state: {
          examData,
          answers,
          examStartTime,
        },
      })
    } catch (error) {
      console.error('Failed to submit exam:', error)
      setNotification({
        type: 'error',
        message: `Lỗi nộp bài: ${error.message}. Vui lòng thử lại.`,
      })
    }
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
    if (!examData || !examData.groups) return []

    const questions = []
    let questionNum = 1

    // Fill short groups (Questions 1-12)
    if (examData.groups.fill_short && Array.isArray(examData.groups.fill_short)) {
      examData.groups.fill_short.forEach(group => {
        if (group.subquestions && Array.isArray(group.subquestions)) {
          group.subquestions.forEach((_, subIdx) => {
            questions.push({
              num: questionNum++,
              id: `${group.id}-${subIdx}`,
              type: 'fill_short'
            })
          })
        }
      })
    }

    // Reorder questions (Questions 13-17)
    if (examData.reorder_questions && Array.isArray(examData.reorder_questions)) {
      examData.reorder_questions.forEach(group => {
        if (group.subquestions && Array.isArray(group.subquestions)) {
          group.subquestions.forEach((_, subIdx) => {
            questions.push({
              num: questionNum++,
              id: `${group.id}-${subIdx}`,
              type: 'reorder'
            })
          })
        }
      })
    }

    // Fill long groups (Questions 18-22)
    if (examData.groups.fill_long && Array.isArray(examData.groups.fill_long)) {
      examData.groups.fill_long.forEach(group => {
        if (group.subquestions && Array.isArray(group.subquestions)) {
          group.subquestions.forEach((_, subIdx) => {
            questions.push({
              num: questionNum++,
              id: `${group.id}-${subIdx}`,
              type: 'fill_long'
            })
          })
        }
      })
    }

    // Reading groups (Questions 23-40)
    if (examData.groups.reading && Array.isArray(examData.groups.reading)) {
      examData.groups.reading.forEach(group => {
        if (group.subquestions && Array.isArray(group.subquestions)) {
          group.subquestions.forEach((_, subIdx) => {
            questions.push({
              num: questionNum++,
              id: `${group.id}-${subIdx}`,
              type: 'reading'
            })
          })
        }
      })
    }

    return questions
  }

  const renderMarkdown = (text) => {
    if (!text) return { __html: '' }
    const html = text
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>') // Bold and Italic
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/\n/g, '<br />') // New lines
    return { __html: html }
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

  // TEST FUNCTION - Select all C answers
  const selectAllC = () => {
    const newAnswers = {}
    allQuestions.forEach(q => {
      newAnswers[q.id] = 'C'
    })
    setAnswers(newAnswers)
  }

  return (
    <div className="exam-page">
      <TopBar userInfo={userInfo} hideLogout={true} />

      {/* TEST BUTTON - Remove in production */}
      {examDoing && (
        <div style={{
          position: 'fixed',
          top: '70px',
          right: '20px',
          zIndex: 9999,
          background: '#ff6b6b',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }} onClick={selectAllC}>
          TEST: Select All C
        </div>
      )}

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
                  <QuestionsList
                    allQuestions={allQuestions}
                    answers={answers}
                    onQuestionClick={scrollToQuestion}
                  />
                </div>

                {/* Submit Button */}
                <div className="sidebar-section">
                  <button onClick={handleSubmitClick} className="btn-submit-sidebar">
                    Nộp bài
                  </button>
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
                          <p className="context-text" dangerouslySetInnerHTML={renderMarkdown(group.context)} />
                        </div>
                        {group.subquestions.map((subq, subIdx) => {
                          const currentQuestionNum = questionNum + subIdx + 1
                          const questionId = `${group.id}-${subIdx}`
                          return (
                            <div key={subIdx} id={`question-${currentQuestionNum}`} className="sub-question">
                              <div className="question-header">
                                <span className="question-number">Câu {currentQuestionNum}</span>
                              </div>
                              {subq.content && (
                                <p className="question-text" dangerouslySetInnerHTML={renderMarkdown(subq.content)} />
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
                  {examData.reorder_questions.map((group, groupIdx) => {
                    let questionNum = 0

                    // Add fill_short questions
                    if (examData.groups.fill_short) {
                      examData.groups.fill_short.forEach(g => {
                        questionNum += g.subquestions.length
                      })
                    }

                    // Add previous reorder group questions
                    for (let i = 0; i < groupIdx; i++) {
                      questionNum += examData.reorder_questions[i].subquestions.length
                    }

                    return (
                      <div key={group.id} className="question-group">
                        {group.context && group.context !== '_' && (
                          <div className="group-context">
                            <p className="context-text" dangerouslySetInnerHTML={renderMarkdown(group.context)} />
                          </div>
                        )}
                        {group.subquestions.map((subq, subIdx) => {
                          const currentQuestionNum = questionNum + subIdx + 1
                          const questionId = `${group.id}-${subIdx}`
                          return (
                            <div key={subIdx} id={`question-${currentQuestionNum}`} className="sub-question">
                              <div className="question-header">
                                <span className="question-number">Câu {currentQuestionNum}</span>
                              </div>
                              {subq.content && (
                                <p
                                  className="question-text"
                                  dangerouslySetInnerHTML={renderMarkdown(subq.content)}
                                />
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
                      examData.reorder_questions.forEach(g => {
                        questionNum += g.subquestions.length
                      })
                    }

                    // Calculate question number offset for fill_long
                    for (let i = 0; i < groupIdx; i++) {
                      questionNum += examData.groups.fill_long[i].subquestions.length
                    }

                    return (
                      <div key={group.id} className="question-group">
                        <div className="group-context">
                          <p className="context-text" dangerouslySetInnerHTML={renderMarkdown(group.context)} />
                        </div>
                        {group.subquestions.map((subq, subIdx) => {
                          const currentQuestionNum = questionNum + subIdx + 1
                          const questionId = `${group.id}-${subIdx}`
                          return (
                            <div key={subIdx} id={`question-${currentQuestionNum}`} className="sub-question">
                              <div className="question-header">
                                <span className="question-number">Câu {currentQuestionNum}</span>
                              </div>
                              {subq.content && (
                                <p className="question-text" dangerouslySetInnerHTML={renderMarkdown(subq.content)} />
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
                      examData.reorder_questions.forEach(g => {
                        questionNum += g.subquestions.length
                      })
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
                          <p className="context-text" dangerouslySetInnerHTML={renderMarkdown(group.context)} />
                        </div>
                        {group.subquestions.map((subq, subIdx) => {
                          const currentQuestionNum = questionNum + subIdx + 1
                          const questionId = `${group.id}-${subIdx}`
                          return (
                            <div key={subIdx} id={`question-${currentQuestionNum}`} className="sub-question">
                              <div className="question-header">
                                <span className="question-number">Câu {currentQuestionNum}</span>
                              </div>
                              {subq.content && (
                                <p className="question-text" dangerouslySetInnerHTML={renderMarkdown(subq.content)} />
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
