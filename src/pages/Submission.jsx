import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import './Submission.css'
import TopBar from '../components/TopBar'
import QuestionsList from '../components/QuestionsList'
import ConfirmModal from '../components/ConfirmModal'
import QuestionsContent from '../components/QuestionsContent'

const API_BASE = 'https://hrj5qc8u76.execute-api.ap-southeast-1.amazonaws.com/prod'
const CHAT_API = 'https://e9hi4aqre3.execute-api.ap-southeast-1.amazonaws.com/v2/chat'

function Submission() {
  const [searchParams] = useSearchParams()
  const [user, setUser] = useState(null)
  const [userInfo, setUserInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeChatQuestion, setActiveChatQuestion] = useState(null)
  const [chatSessions, setChatSessions] = useState({}) // Store chat sessions by question ID
  const [chatInput, setChatInput] = useState('')
  const [selectedModel, setSelectedModel] = useState(() => {
    // Load from localStorage, default to 'watsonx'
    return localStorage.getItem('aiModel') || 'watsonx'
  })
  const navigate = useNavigate()
  const chatMessagesRef = useRef(null)
  const chatInputRef = useRef(null)

  const [examData, setExamData] = useState(null)
  const [answers, setAnswers] = useState(null)
  const [examStartTime, setExamStartTime] = useState(null)
  const [examFinishTime, setExamFinishTime] = useState(null)
  const [showBackModal, setShowBackModal] = useState(false)
  const [showNavigationModal, setShowNavigationModal] = useState(false)
  const isNavigatingAway = useRef(false)

  // Save model preference to localStorage
  useEffect(() => {
    localStorage.setItem('aiModel', selectedModel)
  }, [selectedModel])

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

    // Get exam ID from URL parameter
    const urlExamId = searchParams.get('id')

    // Redirect if no exam ID in URL
    if (!urlExamId) {
      console.warn('No exam ID in URL parameter')
      navigate('/dashboard')
      return
    }

    const savedExam = sessionStorage.getItem('currentExam');
    const savedAnswers = sessionStorage.getItem('examAnswers');
    const savedStartTime = sessionStorage.getItem('examStartTime');
    const savedFinishTime = sessionStorage.getItem('examFinishTime');

    // Redirect if no session data
    if (!savedExam || !savedAnswers) {
      console.warn('No exam data found in session storage for submission page.')
      navigate('/dashboard')
      return
    }

    try {
      const parsedExam = JSON.parse(savedExam);
      
      // Verify exam ID matches URL parameter
      if (urlExamId && parsedExam.id.toString() !== urlExamId) {
        console.warn('Exam ID mismatch')
        navigate('/dashboard')
        return
      }

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

      // Load chat sessions from sessionStorage
      const savedChatSessions = sessionStorage.getItem('chatSessions');
      if (savedChatSessions) {
        try {
          const parsedSessions = JSON.parse(savedChatSessions);
          // Convert timestamp strings back to Date objects and regenerate IDs if needed
          Object.keys(parsedSessions).forEach(questionId => {
            parsedSessions[questionId].messages = parsedSessions[questionId].messages.map((msg, idx) => {
              // Regenerate ID if it's in old format (numeric or doesn't have prefix)
              const needsNewId = typeof msg.id === 'number' || !msg.id.toString().includes('-');
              const newId = needsNewId 
                ? `${msg.sender}-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`
                : msg.id;
              
              return {
                ...msg,
                id: newId,
                timestamp: new Date(msg.timestamp)
              };
            });
          });
          setChatSessions(parsedSessions);
        } catch (error) {
          console.error('Failed to parse chat sessions from session storage', error);
        }
      }
    } catch (error) {
      console.error("Failed to parse exam/answer data from session storage", error);
      navigate('/dashboard');
      return;
    }
    
    setLoading(false)
  }, [navigate, searchParams])


  // Auto-scroll chat messages to bottom only when messages change
  useEffect(() => {
    if (chatMessagesRef.current && activeChatQuestion && chatSessions[activeChatQuestion]) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        if (chatMessagesRef.current) {
          chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
        }
      })
    }
  }, [chatSessions[activeChatQuestion]?.messages.length, activeChatQuestion])

  // Save chat sessions to sessionStorage with debounce to avoid lag
  useEffect(() => {
    if (Object.keys(chatSessions).length > 0) {
      const timeoutId = setTimeout(() => {
        const serializedSessions = {}
        Object.keys(chatSessions).forEach(questionId => {
          const session = chatSessions[questionId]
          serializedSessions[questionId] = {
            messages: session.messages.map(msg => ({
              id: msg.id,
              sender: msg.sender,
              text: msg.text,
              timestamp: msg.timestamp.toISOString(),
              model: msg.model,
              loading: msg.loading,
              streaming: msg.streaming,
              isInitialPrompt: msg.isInitialPrompt
            }))
          }
        })
        sessionStorage.setItem('chatSessions', JSON.stringify(serializedSessions));
      }, 500); // Debounce 500ms

      return () => clearTimeout(timeoutId);
    }
  }, [chatSessions])

  // Handle browser navigation (back/forward button, external navigation, tab close, refresh)
  useEffect(() => {
    // Handle popstate (back/forward button)
    const handlePopState = (e) => {
      if (!isNavigatingAway.current) {
        e.preventDefault()
        // Push state again to keep user on page
        window.history.pushState(null, '', window.location.href)
        setShowNavigationModal(true)
      }
    }

    // Handle beforeunload (closing tab, refreshing, or typing new URL in address bar)
    const handleBeforeUnload = (e) => {
      if (!isNavigatingAway.current) {
        e.preventDefault()
        e.returnValue = 'Lịch sử chat của bạn sẽ không được lưu nếu rời khỏi trang này. Bạn có chắc chắn muốn tiếp tục không?'
        return e.returnValue
      }
    }

    // Handle unload (when page is actually closing)
    const handleUnload = () => {
      if (!isNavigatingAway.current) {
        console.log('User closed tab from submission page')
      }
    }

    // Intercept all link clicks to show custom modal
    const handleClick = (e) => {
      if (!isNavigatingAway.current) {
        const target = e.target.closest('a')
        if (target && target.href) {
          // Check if it's an external link or different page
          const currentOrigin = window.location.origin
          const targetUrl = new URL(target.href, currentOrigin)
          
          if (targetUrl.origin !== currentOrigin || 
              targetUrl.pathname !== window.location.pathname) {
            e.preventDefault()
            setShowNavigationModal(true)
          }
        }
      }
    }

    // Intercept form submissions
    const handleSubmit = (e) => {
      if (!isNavigatingAway.current) {
        const form = e.target
        if (form.action && form.action !== window.location.href) {
          e.preventDefault()
          setShowNavigationModal(true)
        }
      }
    }

    // Push initial state when component mounts
    window.history.pushState(null, '', window.location.href)

    // Add event listeners
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('unload', handleUnload)
    document.addEventListener('click', handleClick, true)
    document.addEventListener('submit', handleSubmit, true)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('unload', handleUnload)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('submit', handleSubmit, true)
    }
  }, [])

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
              id: `initial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              sender: 'ai',
              text: 'Bạn muốn hỏi gì về câu này?',
              timestamp: new Date(),
              isInitialPrompt: true // Mark as initial prompt to exclude from storage
            }
          ]
        }
      }))
    }

    // Focus input field after a short delay to allow animation
    setTimeout(() => {
      chatInputRef.current?.focus()
    }, 400)
  }, [activeChatQuestion, chatSessions])

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
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

    setChatInput('')

    // Get current question data
    const currentQuestion = allQuestions.find(q => q.id === activeChatQuestion)
    if (!currentQuestion) return

    try {
      // Prepare request body with correct answer
      const userChoice = answers[activeChatQuestion]
      const correctAnswer = currentQuestion.data.correct_answer
      
      // Get full context from the current question's context property
      const fullContext = currentQuestion.context || ''
      
      // Build chat history from current session (exclude initial prompt)
      const chatHistory = [...currentSession.messages, userMessage]
        .filter(msg => !msg.isInitialPrompt)
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }))
      
      const requestBody = {
        context: fullContext,
        content: currentQuestion.data.content || '',
        options: currentQuestion.data.options || [],
        correct_answer: correctAnswer,
        user_choice: userChoice || '',
        chat_history: chatHistory,
        model: selectedModel  // Add selected model to request
      }

      // Log request details to console
      console.log('=== Chat API Request ===')
      console.log('Question ID:', activeChatQuestion)
      console.log('Question Type:', currentQuestion.type)
      console.log('Question Number:', currentQuestion.num)
      console.log('URL:', CHAT_API)
      console.log('Headers:', {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.access_token}`
      })
      console.log('Body:', JSON.stringify(requestBody, null, 2))
      console.log('================================================')

      // Add thinking message
      const thinkingId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      setChatSessions(prev => ({
        ...prev,
        [activeChatQuestion]: {
          messages: [
            ...prev[activeChatQuestion].messages,
            {
              id: thinkingId,
              sender: 'ai',
              text: 'Đang suy nghĩ...',
              timestamp: new Date(),
              loading: true
            }
          ]
        }
      }))

      // Call Chat API
      const response = await fetch(CHAT_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.access_token}`
        },
        body: JSON.stringify(requestBody)
      })

      console.log('=== Chat API Response ===')
      console.log('Response Status:', response.status)
      console.log('Response Headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error Response Body:', errorText)
        throw new Error(`API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('Response Data:', data)
      console.log('========================')

      // Parse response from Lambda
      let aiText = 'Xin lỗi, tôi không thể trả lời câu hỏi này.'
      let tokenCount = null
      let modelUsed = null

      // Check for special indicators
      if (data.empty || data.off_topic) {
        aiText = data.message || 'Vui lòng nhập câu hỏi hợp lệ.'
        tokenCount = data.tokens || null
        modelUsed = data.model || null
      } else if (data.response !== undefined) {
        // Standard response format from Lambda
        aiText = data.response || data.message || 'Không có phản hồi.'
        tokenCount = data.tokens || null
        modelUsed = data.model || null
      } else if (data.body) {
        // If body is a string, try parsing it
        try {
          const bodyData = typeof data.body === 'string' ? JSON.parse(data.body) : data.body
          
          // Check for special indicators in body
          if (bodyData.empty || bodyData.off_topic) {
            aiText = bodyData.message || 'Vui lòng nhập câu hỏi hợp lệ.'
          } else {
            aiText = bodyData.response || bodyData.message || JSON.stringify(bodyData)
          }
          tokenCount = bodyData.tokens || null
          modelUsed = bodyData.model || null
        } catch {
          aiText = data.body
        }
      } else if (typeof data === 'string') {
        aiText = data
      } else if (data.message) {
        aiText = data.message
      } else {
        console.warn('Unexpected response format:', data)
        aiText = JSON.stringify(data, null, 2)
      }

      console.log('Parsed AI Text:', aiText.substring(0, 200) + (aiText.length > 200 ? '...' : ''))
      console.log('Token Count:', tokenCount)
      console.log('Model Used:', modelUsed)

      // Animate text token by token (like ChatGPT)
      const words = aiText.split(' ')
      let currentIndex = 0
      
      // Clear thinking message and start with empty text
      setChatSessions(prev => ({
        ...prev,
        [activeChatQuestion]: {
          messages: prev[activeChatQuestion].messages.map(msg =>
            msg.id === thinkingId
              ? { ...msg, text: '', loading: false, streaming: true, tokens: tokenCount, model: modelUsed }
              : msg
          )
        }
      }))

      // Animate words appearing one by one
      const animateText = () => {
        if (currentIndex < words.length) {
          const displayText = words.slice(0, currentIndex + 1).join(' ')
          
          setChatSessions(prev => ({
            ...prev,
            [activeChatQuestion]: {
              messages: prev[activeChatQuestion].messages.map(msg =>
                msg.id === thinkingId
                  ? { ...msg, text: displayText }
                  : msg
              )
            }
          }))
          
          currentIndex++
          // Adjust speed: faster streaming effect
          setTimeout(animateText, 25)
        } else {
          // Mark streaming as complete
          setChatSessions(prev => ({
            ...prev,
            [activeChatQuestion]: {
              messages: prev[activeChatQuestion].messages.map(msg =>
                msg.id === thinkingId
                  ? { ...msg, streaming: false }
                  : msg
              )
            }
          }))
        }
      }
      
      animateText()
    } catch (error) {
      console.error('=== Chat API Error ===')
      console.error('Error:', error)
      console.error('Error Message:', error.message)
      console.error('======================')

      // Replace thinking message with error
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
  }, [chatInput, activeChatQuestion, chatSessions, allQuestions, answers, user, selectedModel])

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  const handleTextareaChange = useCallback((e) => {
    setChatInput(e.target.value)
  }, [])

  const handleBackToDashboard = () => {
    // Always show confirmation modal
    setShowBackModal(true)
  };

  const confirmBackToDashboard = () => {
    // Set flag to allow navigation
    isNavigatingAway.current = true
    
    // Clear all exam and submission related storage
    sessionStorage.removeItem('currentExam');
    sessionStorage.removeItem('examAnswers');
    sessionStorage.removeItem('examStartTime');
    sessionStorage.removeItem('examFinishTime');
    sessionStorage.removeItem('examTimeRemaining');
    sessionStorage.removeItem('examStarted');
    sessionStorage.removeItem('examDoing');
    sessionStorage.removeItem('chatSessions');
    navigate('/dashboard');
  };

  const handleConfirmNavigation = () => {
    // Set flag to allow navigation
    isNavigatingAway.current = true
    
    // Close modal and navigate back
    setShowNavigationModal(false)
    navigate('/dashboard')
  }

  const handleCancelNavigation = () => {
    setShowNavigationModal(false)
    // User chose to stay, do nothing
  }

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
            <QuestionsContent
              examData={examData}
              answers={answers}
              mode="submission"
              onChatBubbleClick={handleChatBubbleClick}
              activeChatQuestion={activeChatQuestion}
            />
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
              <div className="chat-header-actions">
                <label htmlFor="model-selector" className="model-selector-label">Chọn model:</label>
                <select 
                  id="model-selector"
                  className="model-selector"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  title="Chọn mô hình AI"
                >
                  <option value="watsonx">WatsonX</option>
                  <option value="gemini">Gemini</option>
                </select>
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
            </div>

            <div className="chat-messages" ref={chatMessagesRef}>
              {currentChatSession?.messages.map(message => (
                message.sender === 'user' ? (
                  <div key={message.id} className={`chat-message ${message.sender}`}>
                    <div className="message-avatar user-avatar">
                      {userInfo?.picture ? (
                        <img src={userInfo.picture} alt={userInfo.username || 'User'} className="user-avatar-img" />
                      ) : (
                        <span className="user-avatar-initials">
                          {userInfo?.username?.substring(0, 2).toUpperCase() || userInfo?.name?.substring(0, 2).toUpperCase() || userInfo?.email?.substring(0, 2).toUpperCase() || '👤'}
                        </span>
                      )}
                    </div>
                    <div className="message-content">
                      <div
                        className="message-text"
                        dangerouslySetInnerHTML={{ __html: message.text }}
                      />
                      <div className="message-time">
                        {message.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="chat-message ai">
                    <div className="message-avatar ai-avatar">
                      {message.model === 'gemini' && (
                        <img 
                          src="https://registry.npmmirror.com/@lobehub/icons-static-png/1.74.0/files/dark/gemini-color.png" 
                          alt="Gemini"
                          className="ai-avatar-img"
                        />
                      )}
                      {message.model === 'watsonx' && (
                        <img 
                          src="https://ibm.gallerycdn.vsassets.io/extensions/ibm/watsonx-data/1.2.0/1758701492843/Microsoft.VisualStudio.Services.Icons.Default" 
                          alt="WatsonX"
                          className="ai-avatar-img"
                        />
                      )}
                    </div>
                    <div className="message-content">
                      <div className="ai-response-text">
                        {message.loading ? (
                          <div className="thinking-text">
                            Đang suy nghĩ<span className="thinking-dots"></span>
                          </div>
                        ) : (
                          <>
                            <span dangerouslySetInnerHTML={{ __html: message.text }} />
                            {message.streaming && <span className="streaming-cursor">▊</span>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>

            <div className="chat-input-area">
              <div className="chat-input-wrapper">
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyPress}
                  placeholder="Nhập câu hỏi... (Enter: gửi, Shift+Enter: xuống dòng)"
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

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={showBackModal}
        onClose={() => setShowBackModal(false)}
        onConfirm={confirmBackToDashboard}
        title="Quay lại Dashboard"
        message="Lịch sử chat của bạn sẽ không được lưu nếu quay lại Dashboard. Bạn có chắc chắn muốn tiếp tục không?"
        confirmText="Quay lại"
        cancelText="Ở lại"
        confirmStyle="danger"
      />

      <ConfirmModal
        isOpen={showNavigationModal}
        onClose={handleCancelNavigation}
        onConfirm={handleConfirmNavigation}
        title="Rời khỏi trang"
        message="Lịch sử chat của bạn sẽ không được lưu nếu rời khỏi trang này. Bạn có chắc chắn muốn tiếp tục không?"
        confirmText="Rời khỏi"
        cancelText="Ở lại"
        confirmStyle="danger"
      />
    </div>
  )
}

export default Submission
