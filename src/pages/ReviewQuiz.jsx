import { useState, useEffect, useCallback, useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import './ReviewQuiz.css'
import TopBar from '../components/TopBar'
import QuestionsContent from '../components/QuestionsContent'

const GEN_EXAM_API = 'https://cr45imuuf0.execute-api.ap-southeast-1.amazonaws.com/v2/gen-exam'

export default function ReviewQuiz() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [userInfo, setUserInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // AI Generator state
  const [aiConfig, setAiConfig] = useState({
    num_questions: 5,
    english_level: 'B1',
    focus_areas: ['grammar'],
    question_type: 'fill_short',
    context: 'general',
    difficulty: 'medium',
    include_explanations: true
  })
  const [generatingAI, setGeneratingAI] = useState(false)
  const [aiQuestions, setAiQuestions] = useState([])
  const [aiAnswers, setAiAnswers] = useState({})

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    const savedUserInfo = localStorage.getItem('userInfo')

    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }

    if (savedUserInfo) {
      setUserInfo(JSON.parse(savedUserInfo))
    }

    // Restore AI questions and answers from session storage
    const savedAiQuestions = sessionStorage.getItem('aiQuestions')
    const savedAiAnswers = sessionStorage.getItem('aiAnswers')
    const savedAiConfig = sessionStorage.getItem('aiConfig')

    if (savedAiQuestions) {
      try {
        setAiQuestions(JSON.parse(savedAiQuestions))
      } catch (err) {
        console.error('Error loading saved AI questions:', err)
      }
    }

    if (savedAiAnswers) {
      try {
        setAiAnswers(JSON.parse(savedAiAnswers))
      } catch (err) {
        console.error('Error loading saved AI answers:', err)
      }
    }

    if (savedAiConfig) {
      try {
        setAiConfig(JSON.parse(savedAiConfig))
      } catch (err) {
        console.error('Error loading saved AI config:', err)
      }
    }

    setLoading(false)
  }, [])

  const getUserId = useCallback(() => {
    return userInfo?.sub || userInfo?.username || userInfo?.email || user?.user_id || 'test-user-id'
  }, [userInfo, user])

  // Save AI questions to session storage whenever they change
  useEffect(() => {
    if (aiQuestions.length > 0) {
      sessionStorage.setItem('aiQuestions', JSON.stringify(aiQuestions))
    }
  }, [aiQuestions])

  // Save AI answers to session storage whenever they change
  useEffect(() => {
    if (Object.keys(aiAnswers).length > 0 || aiQuestions.length > 0) {
      sessionStorage.setItem('aiAnswers', JSON.stringify(aiAnswers))
    }
  }, [aiAnswers, aiQuestions])

  // Save AI config to session storage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('aiConfig', JSON.stringify(aiConfig))
  }, [aiConfig])

  const handleGoBack = () => {
    navigate('/dashboard')
  }

  // AI Generator handlers
  const handleAiConfigChange = (field, value) => {
    setAiConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleGenerateAI = async () => {
    setGeneratingAI(true)
    setError(null)
    setAiAnswers({})

    try {
      const payload = {
        user_id: getUserId(),
        ...aiConfig
      }

      const response = await fetch(GEN_EXAM_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Không thể tạo câu hỏi (mã ${response.status})`)
      }

      const data = await response.json()
      const body = data.body ? (typeof data.body === 'string' ? JSON.parse(data.body) : data.body) : data

      const generatedQuestions = Array.isArray(body.questions) ? body.questions : []

      // Format questions to match the existing structure
      const formattedQuestions = generatedQuestions.map((q, idx) => ({
        ...q,
        displayIndex: idx + 1,
        question_id: q.question_id || `ai-${Date.now()}-${idx}`,
        // Keep correct_answer as letter (A-D) - Lambda now returns letters directly
        correct_answer: typeof q.correct_answer === 'string' ? q.correct_answer.toUpperCase() : q.correct_answer
      }))

      setAiQuestions(formattedQuestions)
      
      // Scroll to questions after a short delay to allow rendering
      setTimeout(() => {
        const questionsSection = document.querySelector('.questions-content')
        if (questionsSection) {
          questionsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    } catch (err) {
      setError(err.message || 'Đã có lỗi xảy ra khi tạo câu hỏi AI')
      setAiQuestions([])
    } finally {
      setGeneratingAI(false)
    }
  }

  // Transform AI questions into QuestionsContent format
  const transformToExamData = useMemo(() => {
    if (!aiQuestions.length) return null

    const questionType = aiConfig.question_type
    const groups = []

    aiQuestions.forEach((q, idx) => {
      const groupId = `ai-group-${idx}`

      // Format options with letter prefix (A., B., C., D.)
      const formattedOptions = q.options.map((opt, optIdx) =>
        `${String.fromCharCode(65 + optIdx)}. ${opt}`
      )

      // Use letter-based answer directly from Lambda (A-D)
      const correctAnswerLetter = q.correct_answer

      const subquestion = {
        content: q.question,
        options: formattedOptions,
        correct_answer: correctAnswerLetter,
        explanation: q.explanation || 'Không có giải thích cho câu hỏi này.'
      }

      groups.push({
        id: groupId,
        context: null, // AI questions don't have context passages
        subquestions: [subquestion]
      })
    })

    // Map question types to the structure QuestionsContent expects
    const typeMapping = {
      'fill_short': 'fill_short',
      'multiple_choice': 'fill_short', // Treat as fill_short
      'rearrange': 'reorder',
      'reading': 'reading'
    }

    const mappedType = typeMapping[questionType] || 'fill_short'

    if (mappedType === 'reorder') {
      return { reorder_questions: groups }
    } else if (mappedType === 'reading') {
      return { groups: { reading: groups } }
    } else {
      return { groups: { [mappedType]: groups } }
    }
  }, [aiQuestions, aiConfig.question_type])

  const handleAiSelect = (questionId, optionLetter) => {
    // QuestionsContent passes letters (A, B, C, D)
    setAiAnswers(prev => ({
      ...prev,
      [questionId]: optionLetter
    }))
  }

  const aiAnsweredCount = useMemo(() => {
    return aiQuestions.filter((q, idx) => {
      const groupId = `ai-group-${idx}`
      const questionId = `${groupId}-0`
      return aiAnswers[questionId] !== undefined
    }).length
  }, [aiAnswers, aiQuestions])

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
    <div className="review-page">
      <TopBar userInfo={userInfo} />

      <main className="review-main">
        <div className="container">
          <header className="review-header">
            <div>
              <p className="review-eyebrow">Tạo đề AI</p>
              <h1>Tạo bộ câu hỏi AI thông minh</h1>
              <p className="review-lead">
                Sử dụng trí tuệ nhân tạo để tạo bộ câu hỏi tiếng Anh theo yêu cầu của bạn. Tùy chỉnh trình độ, chủ đề và độ khó để học tập hiệu quả hơn.
              </p>
            </div>
            <div className="review-actions">
              <button
                className="btn-outline"
                onClick={handleGoBack}
              >
                Quay lại
              </button>
            </div>
          </header>

          {error && (
            <div className="review-banner error">
              <div className="banner-dot"></div>
              <div>
                <p className="banner-title">Không thể tạo câu hỏi</p>
                <p className="banner-desc">{error}</p>
              </div>
            </div>
          )}

          <section className="ai-generator-section">
              <div className="ai-config-card">
                <h2 className="ai-config-title">Cấu hình tạo đề AI</h2>
                <p className="ai-config-desc">Tùy chỉnh các tham số để tạo bộ câu hỏi phù hợp với nhu cầu học tập của bạn</p>

                <div className="ai-config-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="num-questions">Số lượng câu hỏi</label>
                      <select
                        id="num-questions"
                        value={aiConfig.num_questions}
                        onChange={(e) => handleAiConfigChange('num_questions', parseInt(e.target.value))}
                        className="form-select"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                          <option key={num} value={num}>{num} câu</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="english-level">Trình độ tiếng Anh (CEFR)</label>
                      <select
                        id="english-level"
                        value={aiConfig.english_level}
                        onChange={(e) => handleAiConfigChange('english_level', e.target.value)}
                        className="form-select"
                      >
                        <option value="A1">A1 - Beginner</option>
                        <option value="A2">A2 - Elementary</option>
                        <option value="B1">B1 - Intermediate</option>
                        <option value="B2">B2 - Upper Intermediate</option>
                        <option value="C1">C1 - Advanced</option>
                        <option value="C2">C2 - Proficient</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="focus-area">Nội dung ôn tập</label>
                      <select
                        id="focus-area"
                        value={aiConfig.focus_areas[0]}
                        onChange={(e) => handleAiConfigChange('focus_areas', [e.target.value])}
                        className="form-select"
                      >
                        <option value="vocabulary">Vocabulary - Từ vựng</option>
                        <option value="grammar">Grammar - Ngữ pháp</option>
                        <option value="reading">Reading Comprehension - Đọc hiểu</option>
                        <option value="sentence_structure">Sentence Structure - Cấu trúc câu</option>
                        <option value="idioms">Idioms & Phrases - Thành ngữ</option>
                        <option value="prepositions">Prepositions - Giới từ</option>
                        <option value="tenses">Tenses - Thì</option>
                        <option value="conditionals">Conditionals - Câu điều kiện</option>
                        <option value="reported_speech">Reported Speech - Câu tường thuật</option>
                        <option value="passive_voice">Passive Voice - Câu bị động</option>
                        <option value="articles">Articles - Mạo từ</option>
                        <option value="modal_verbs">Modal Verbs - Động từ khuyết thiếu</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="question-type">Loại câu hỏi</label>
                      <select
                        id="question-type"
                        value={aiConfig.question_type}
                        onChange={(e) => handleAiConfigChange('question_type', e.target.value)}
                        className="form-select"
                      >
                        <option value="fill_short">Fill in the Blank - Điền khuyết</option>
                        <option value="multiple_choice">Multiple Choice - Trắc nghiệm</option>
                        <option value="rearrange">Sentence Rearrangement - Sắp xếp câu</option>
                        <option value="reading">Reading Comprehension - Đọc hiểu</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="context">Chủ đề / Ngữ cảnh</label>
                      <select
                        id="context"
                        value={aiConfig.context}
                        onChange={(e) => handleAiConfigChange('context', e.target.value)}
                        className="form-select"
                      >
                        <option value="general">General - Tổng quát</option>
                        <option value="business">Business English - Tiếng Anh thương mại</option>
                        <option value="academic">Academic English - Tiếng Anh học thuật</option>
                        <option value="daily">Daily Conversation - Hội thoại hàng ngày</option>
                        <option value="travel">Travel & Tourism - Du lịch</option>
                        <option value="technology">Technology & Science - Công nghệ & Khoa học</option>
                        <option value="health">Health & Lifestyle - Sức khỏe & Lối sống</option>
                        <option value="education">Education - Giáo dục</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="difficulty">Độ khó</label>
                      <select
                        id="difficulty"
                        value={aiConfig.difficulty}
                        onChange={(e) => handleAiConfigChange('difficulty', e.target.value)}
                        className="form-select"
                      >
                        <option value="easy">Easy - Dễ</option>
                        <option value="medium">Medium - Trung bình</option>
                        <option value="hard">Hard - Khó</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group checkbox-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={aiConfig.include_explanations}
                          onChange={(e) => handleAiConfigChange('include_explanations', e.target.checked)}
                        />
                        <span>Bao gồm giải thích chi tiết</span>
                      </label>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      className="btn-primary btn-generate"
                      onClick={handleGenerateAI}
                      disabled={generatingAI}
                    >
                      {generatingAI ? 'Đang tạo câu hỏi...' : 'Tạo bộ câu hỏi AI'}
                    </button>
                  </div>
                </div>
              </div>

              {generatingAI && (
                <div className="loading-strip">
                  <div className="dot dot-1"></div>
                  <div className="dot dot-2"></div>
                  <div className="dot dot-3"></div>
                  <span>AI đang tạo câu hỏi theo yêu cầu của bạn...</span>
                </div>
              )}

              {!generatingAI && aiQuestions.length > 0 && transformToExamData && (
                <QuestionsContent
                  examData={transformToExamData}
                  answers={aiAnswers}
                  mode="submission"
                  onAnswerSelect={handleAiSelect}
                />
              )}

              {!generatingAI && aiQuestions.length > 0 && (
                <footer className="review-footer">
                  <div className="footer-left">
                    <p className="answered-counter">Đã trả lời {aiAnsweredCount}/{aiQuestions.length} câu</p>
                  </div>
                  <div className="footer-actions">
                    <button
                      className="btn-outline"
                      onClick={() => {
                        setAiQuestions([])
                        setAiAnswers({})
                        // Clear session storage when resetting
                        sessionStorage.removeItem('aiQuestions')
                        sessionStorage.removeItem('aiAnswers')
                        sessionStorage.removeItem('aiConfig')
                      }}
                      disabled={generatingAI}
                    >
                      Xóa & Tạo mới
                    </button>
                  </div>
                </footer>
              )}
          </section>
        </div>
      </main>
    </div>
  )
}
