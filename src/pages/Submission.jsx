import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import './Submission.css'
import TopBar from '../components/TopBar'
import QuestionsList from '../components/QuestionsList'

const API_BASE = 'https://hrj5qc8u76.execute-api.ap-southeast-1.amazonaws.com/prod'
const CHAT_API = 'https://e9hi4aqre3.execute-api.ap-southeast-1.amazonaws.com/v2/chat'

function Submission() {
  const [user, setUser] = useState(null)
  const [userInfo, setUserInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeChatQuestion, setActiveChatQuestion] = useState(null)
  const [chatSessions, setChatSessions] = useState({}) // Store chat sessions by question ID
  const [chatInput, setChatInput] = useState('')
  const navigate = useNavigate()
  const chatMessagesRef = useRef(null)

  const [examData, setExamData] = useState(null)
  const [answers, setAnswers] = useState(null)
  const [examStartTime, setExamStartTime] = useState(null)
  const [examFinishTime, setExamFinishTime] = useState(null)

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    const savedUserInfo = localStorage.getItem('userInfo')

    if (savedUser) {
      const parsedUser = JSON.parse(savedUser)
      setUser(parsedUser)
      if (savedUserInfo) {
        setUserInfo(JSON.parse(savedUserInfo))
      }
    }

    const savedExam = sessionStorage.getItem('currentExam');
    const savedAnswers = sessionStorage.getItem('examAnswers');
    const savedStartTime = sessionStorage.getItem('examStartTime');
    const savedFinishTime = sessionStorage.getItem('examFinishTime');

    if (savedExam && savedAnswers) {
        try {
            const parsedExam = JSON.parse(savedExam);
            setExamData(parsedExam.data);
            setAnswers(JSON.parse(savedAnswers));
            if (savedStartTime) {
                setExamStartTime(new Date(savedStartTime));
            }
            if (savedFinishTime) {
                setExamFinishTime(new Date(savedFinishTime));
            } else {
                // Fallback: Set finish time to now if not stored
                setExamFinishTime(new Date());
            }
        } catch (error) {
            console.error("Failed to parse exam/answer data from session storage", error);
            navigate('/dashboard');
            return;
        }
    } else {
        console.warn("No exam data found in session storage for submission page.");
        navigate('/dashboard');
        return;
    }
    setLoading(false)
  }, [navigate])


  // Auto-scroll chat messages to bottom
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [chatSessions, activeChatQuestion])

  const formatDateTime = (date) => {
    if (!date) return ''
    const d = new Date(date)
    const hours = d.getHours().toString().padStart(2, '0')
    const minutes = d.getMinutes().toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const year = d.getFullYear()
    return `${hours}:${minutes} - ${day}/${month}/${year}`
  }

  const calculateDuration = (startTime, finishTime) => {
    if (!startTime || !finishTime) return 'N/A'
    const durationMs = finishTime - startTime
    const minutes = Math.floor(durationMs / 60000)
    const seconds = Math.floor((durationMs % 60000) / 1000)
    return `${minutes} phút ${seconds} giây`
  }

  const scrollToQuestion = (questionNum) => {
    const element = document.getElementById(`question-${questionNum}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleChatBubbleClick = useCallback((questionId) => {
    // If clicking the same question, close chat
    if (activeChatQuestion === questionId) {
      setActiveChatQuestion(null)
      return
    }

    // Open chat for this question
    setActiveChatQuestion(questionId)

    // Initialize chat session if it doesn't exist
    if (!chatSessions[questionId]) {
      setChatSessions(prev => ({
        ...prev,
        [questionId]: {
          messages: [
            {
              id: 1,
              sender: 'ai',
              text: '👋 Xin chào! Tôi là trợ lý AI của bạn.\n\n💡 Tôi có thể giúp bạn:\n• Giải thích đáp án chi tiết\n• Phân tích các lựa chọn khác\n• Cung cấp kiến thức bổ sung\n\nHãy hỏi tôi bất cứ điều gì về câu hỏi này nhé! 😊',
              timestamp: new Date()
            }
          ]
        }
      }))
    }
  }, [activeChatQuestion, chatSessions])

  const renderMarkdown = (text) => {
    if (!text) return { __html: '' }
    const html = text
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>') // Bold and Italic
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/\n/g, '<br />')
    return { __html: html }
  }

  // Build flat list of all questions - memoized for performance
  const getAllQuestions = useCallback(() => {
    if (!examData) return []

    const questions = []
    let questionNum = 1

    // Fill short groups
    if (examData.groups.fill_short) {
      examData.groups.fill_short.forEach(group => {
        group.subquestions.forEach((subq, subIdx) => {
          questions.push({
            num: questionNum++,
            id: `${group.id}-${subIdx}`,
            type: 'fill_short',
            data: subq,
            context: group.context,
            isFirstInGroup: subIdx === 0
          })
        })
      })
    }

    // Reorder questions
    if (examData.reorder_questions) {
      examData.reorder_questions.forEach(group => {
        group.subquestions.forEach((subq, subIdx) => {
          questions.push({
            num: questionNum++,
            id: `${group.id}-${subIdx}`,
            type: 'reorder',
            data: subq,
            context: group.context && group.context !== '_' ? group.context : null,
            isFirstInGroup: subIdx === 0
          })
        })
      })
    }

    // Fill long groups
    if (examData.groups.fill_long) {
      examData.groups.fill_long.forEach(group => {
        group.subquestions.forEach((subq, subIdx) => {
          questions.push({
            num: questionNum++,
            id: `${group.id}-${subIdx}`,
            type: 'fill_long',
            data: subq,
            context: group.context,
            isFirstInGroup: subIdx === 0
          })
        })
      })
    }

    // Reading groups
    if (examData.groups.reading) {
      examData.groups.reading.forEach(group => {
        group.subquestions.forEach((subq, subIdx) => {
          questions.push({
            num: questionNum++,
            id: `${group.id}-${subIdx}`,
            type: 'reading',
            data: subq,
            context: group.context,
            isFirstInGroup: subIdx === 0
          })
        })
      })
    }

    return questions
  }, [examData])

  // Memoize the questions list
  const allQuestions = useMemo(() => getAllQuestions(), [getAllQuestions])

  // Calculate score based on correct_answer comparison
  const calculateScore = useMemo(() => {
    if (!answers) return { correct: 0, total: allQuestions.length, percentage: 0 };
    
    let correct = 0
    const total = allQuestions.length

    allQuestions.forEach(question => {
      const userAnswer = answers[question.id]
      const correctAnswer = question.data.correct_answer
      if (userAnswer === correctAnswer) {
        correct++
      }
    })

    return {
      correct,
      total,
      percentage: total > 0 ? Math.round((correct / total) * 100) : 0
    }
  }, [allQuestions, answers])

  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim() || !activeChatQuestion) return

    const currentSession = chatSessions[activeChatQuestion] || { messages: [] }
    const userMessage = {
      id: currentSession.messages.length + 1,
      sender: 'user',
      text: chatInput,
      timestamp: new Date()
    }

    // Add user message
    setChatSessions(prev => ({
      ...prev,
      [activeChatQuestion]: {
        messages: [...currentSession.messages, userMessage]
      }
    }))

    const userQuestion = chatInput
    setChatInput('')

    // Reset textarea height
    setTimeout(() => {
      const textarea = document.querySelector('.chat-input-area textarea')
      if (textarea) {
        textarea.style.height = 'auto'
      }
    }, 0)

    // Get current question data
    const currentQuestion = allQuestions.find(q => q.id === activeChatQuestion)
    if (!currentQuestion) return

    try {
      // Add loading message
      const loadingId = currentSession.messages.length + 2
      setChatSessions(prev => ({
        ...prev,
        [activeChatQuestion]: {
          messages: [
            ...prev[activeChatQuestion].messages,
            {
              id: loadingId,
              sender: 'ai',
              text: '<div class="typing-indicator"><span></span><span></span><span></span></div>',
              timestamp: new Date(),
              loading: true
            }
          ]
        }
      }))

      // Prepare request body
      const userChoice = answers[activeChatQuestion]
      const requestBody = {
        content: currentQuestion.data.content || currentQuestion.context || '',
        options: currentQuestion.data.options || [],
        correct_answer: userChoice || 'A',
        user_choice: userChoice || 'A',
        user_question: userQuestion
      }

      // Log request details to console
      console.log('=== Chat API Request ===')
      console.log('URL:', CHAT_API)
      console.log('Headers:', {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.access_token}`
      })
      console.log('Body:', JSON.stringify(requestBody, null, 2))

      // Call Chat API
      const response = await fetch(CHAT_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.access_token}`
        },
        body: JSON.stringify(requestBody)
      })

      console.log('Response Status:', response.status)

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      console.log('Response Data:', data)

      // Parse response (handle different response formats)
      let aiText = 'Xin lỗi, tôi không thể trả lời câu hỏi này.'

      if (typeof data === 'string') {
        aiText = data
      } else if (data.body) {
        aiText = typeof data.body === 'string' ? data.body : JSON.stringify(data.body)
      } else if (data.explanation) {
        aiText = data.explanation
      } else if (data.response) {
        aiText = data.response
      } else if (data.message) {
        aiText = data.message
      }

      // Update with actual response
      setChatSessions(prev => ({
        ...prev,
        [activeChatQuestion]: {
          messages: prev[activeChatQuestion].messages.map(msg =>
            msg.id === loadingId
              ? { ...msg, text: aiText, loading: false }
              : msg
          )
        }
      }))
    } catch (error) {
      console.error('Chat API error:', error)

      // Show error message
      setChatSessions(prev => ({
        ...prev,
        [activeChatQuestion]: {
          messages: prev[activeChatQuestion].messages.map(msg =>
            msg.loading
              ? {
                  ...msg,
                  text: `Xin lỗi, đã có lỗi xảy ra: ${error.message}. Vui lòng thử lại sau.`,
                  loading: false
                }
              : msg
          )
        }
      }))
    }
  }, [chatInput, activeChatQuestion, chatSessions, allQuestions, answers, user])

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleTextareaChange = (e) => {
    setChatInput(e.target.value)

    // Auto-resize textarea
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 168) + 'px'
  }

  const renderQuestion = useCallback((question) => {
    const questionId = question.id
    const userAnswer = answers?.[questionId]
    const correctAnswer = question.data.correct_answer
    const isCorrect = userAnswer === correctAnswer
    const isEmptyAnswer = !userAnswer

    return (
      <div key={questionId} id={`question-${question.num}`} className="question-card">
        <div className="question-header-row">
          <div className="question-header">
            <span className="question-number">Câu {question.num}</span>
            <span className={`answer-indicator ${isCorrect ? 'correct' : 'incorrect'}`}>
              {isCorrect ? '✓ Đúng' : isEmptyAnswer ? '○ Chưa trả lời' : '✗ Sai'}
            </span>
          </div>
          <button
            className={`chat-bubble-btn ${activeChatQuestion === questionId ? 'active' : ''}`}
            onClick={() => handleChatBubbleClick(questionId)}
            title="Chat với AI về câu hỏi này"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {/* Robot head */}
              <rect x="6" y="8" width="12" height="10" rx="2" ry="2"></rect>
              {/* Antenna */}
              <line x1="12" y1="8" x2="12" y2="5"></line>
              <circle cx="12" cy="4" r="1" fill="currentColor"></circle>
              {/* Eyes */}
              <line x1="9.5" y1="12" x2="9.5" y2="14"></line>
              <line x1="14.5" y1="12" x2="14.5" y2="14"></line>
              {/* Ears */}
              <path d="M6 11 L4 11 C3.5 11 3 11.5 3 12 L3 14 C3 14.5 3.5 15 4 15 L6 15"></path>
              <path d="M18 11 L20 11 C20.5 11 21 11.5 21 12 L21 14 C21 14.5 20.5 15 20 15 L18 15"></path>
              {/* Chat bubble */}
              <circle cx="18" cy="7" r="3.5"></circle>
              <circle cx="17" cy="6.5" r="0.5" fill="currentColor"></circle>
              <circle cx="18" cy="6.5" r="0.5" fill="currentColor"></circle>
              <circle cx="19" cy="6.5" r="0.5" fill="currentColor"></circle>
            </svg>
          </button>
        </div>

        {question.context && question.isFirstInGroup && (
          <div className="group-context">
            <p className="context-text" dangerouslySetInnerHTML={renderMarkdown(question.context)} />
          </div>
        )}

        {question.data.content && (
          <p
            className="question-text"
            dangerouslySetInnerHTML={renderMarkdown(question.data.content)}
          />
        )}

        <div className="options-list">
          {question.data.options.map((option, optIdx) => {
            const optionLetter = String.fromCharCode(65 + optIdx)
            const isUserAnswer = userAnswer === optionLetter
            const isCorrectAnswer = correctAnswer === optionLetter

            // Logic:
            // - Câu đúng: bôi xanh đáp án user chọn
            // - Câu sai: bôi đỏ đáp án user chọn + bôi xanh đáp án đúng
            // - Chưa chọn: bôi xanh đáp án đúng
            let optionClass = 'option-item'
            if (isUserAnswer && isCorrect) {
              optionClass += ' user-answer-correct'
            } else if (isUserAnswer && !isCorrect) {
              optionClass += ' user-answer-incorrect'
            }
            if ((isEmptyAnswer || !isCorrect) && isCorrectAnswer) {
              optionClass += ' correct-answer-highlight'
            }

            return (
              <div key={optIdx} className={optionClass}>
                <span className="option-label">{optionLetter}.</span>
                <span className="option-text">{option}</span>
                {isUserAnswer && isCorrect && (
                  <span className="option-badge correct">✓ Bạn chọn</span>
                )}
                {isUserAnswer && !isCorrect && (
                  <span className="option-badge incorrect">✗ Bạn chọn sai</span>
                )}
                {(isEmptyAnswer || !isCorrect) && isCorrectAnswer && (
                  <span className="option-badge correct-ans">✓ Đáp án đúng</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }, [answers, activeChatQuestion, handleChatBubbleClick, allQuestions])

  const handleBackToDashboard = () => {
    // Clear all exam and submission related storage
    sessionStorage.removeItem('currentExam');
    sessionStorage.removeItem('examAnswers');
    sessionStorage.removeItem('examStartTime');
    sessionStorage.removeItem('examFinishTime');
    sessionStorage.removeItem('examTimeRemaining');
    sessionStorage.removeItem('examStarted');
    sessionStorage.removeItem('examDoing');
    navigate('/dashboard');
  };

  if (loading || !examData || !answers) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Đang tải kết quả...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  const currentChatSession = activeChatQuestion ? chatSessions[activeChatQuestion] : null

  return (
    <div className="submission-page">
      <TopBar userInfo={userInfo} />

      <main className="submission-main">
        <div className={`submission-container ${activeChatQuestion ? 'with-chat' : ''}`}>
          {/* Sidebar */}
          <aside className="submission-sidebar">
            <div className="sidebar-content">
              {/* Score Summary */}
              <div className="sidebar-section">
                <h3 className="sidebar-title">Kết quả</h3>
                <div className="quiz-info">
                  <div className="quiz-info-item">
                    <span className="quiz-label">Điểm:</span>
                    <span className="quiz-value">{calculateScore.correct}/{calculateScore.total}</span>
                  </div>
                  <div className="quiz-info-item">
                    <span className="quiz-label">Phần trăm:</span>
                    <span className="quiz-value">{calculateScore.percentage}%</span>
                  </div>
                </div>
              </div>

              {/* Exam Info */}
              <div className="sidebar-section exam-info-section">
                <div className="exam-info-card">
                  <div className="info-row">
                    <span className="info-label">Mã đề:</span>
                    <span className="info-value">{examData.quiz_id}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Bắt đầu:</span>
                    <span className="info-value">{formatDateTime(examStartTime)}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Kết thúc:</span>
                    <span className="info-value">{formatDateTime(examFinishTime)}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Thời gian:</span>
                    <span className="info-value">{calculateDuration(examStartTime, examFinishTime)}</span>
                  </div>
                </div>
              </div>

              {/* Questions List */}
              <div className="sidebar-section question-list-section">
                <QuestionsList
                  allQuestions={allQuestions}
                  answers={answers}
                  onQuestionClick={scrollToQuestion}
                  showResults={true}
                />
              </div>

              {/* Back to Dashboard Button */}
              <div className="sidebar-section">
                <button onClick={handleBackToDashboard} className="btn-back-dashboard">
                  Quay lại Dashboard
                </button>
              </div>
            </div>
          </aside>

          {/* Questions Content */}
          <div className="submission-content">
            {/* Questions List */}
            {allQuestions.map((question, index) => renderQuestion(question, index))}
          </div>

          {/* Chat Pane - Always rendered, visibility controlled by CSS */}
          <div className="chat-pane">
            <div className="chat-header">
              <div className="chat-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>Chat với AI - Câu {allQuestions.find(q => q.id === activeChatQuestion)?.num}</span>
              </div>
              <button
                className="close-chat-btn"
                onClick={() => setActiveChatQuestion(null)}
                title="Đóng chat"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="chat-messages" ref={chatMessagesRef}>
              {currentChatSession?.messages.map(message => (
                <div key={message.id} className={`chat-message ${message.sender}`}>
                  <div className="message-avatar">
                    {message.sender === 'ai' ? '🤖' : '👤'}
                  </div>
                  <div className="message-content">
                    <div
                      className={`message-text ${message.loading ? 'loading' : ''}`}
                      dangerouslySetInnerHTML={{ __html: message.text }}
                    />
                    <div className="message-time">
                      {message.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="chat-input-area">
              <div className="chat-input-wrapper">
                <textarea
                  value={chatInput}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyPress}
                  placeholder="Nhập câu hỏi... (Enter: gửi, Shift+Enter: xuống dòng)"
                  rows={1}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim()}
                  className="send-btn"
                  title="Gửi tin nhắn"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Submission
