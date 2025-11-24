import { useState, useEffect, useCallback, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import './ReviewQuiz.css'
import TopBar from '../components/TopBar'

const REVIEW_API = 'https://76545fpdoh.execute-api.ap-southeast-1.amazonaws.com/v1/wrong-answer'

const shuffleAndTake = (list, count) => {
  const pool = [...list]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

export default function ReviewQuiz() {
  const [user, setUser] = useState(null)
  const [userInfo, setUserInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [questionPool, setQuestionPool] = useState([])
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [error, setError] = useState(null)
  const [meta, setMeta] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [wrongSamples, setWrongSamples] = useState([])
  const [activeTab, setActiveTab] = useState('quiz')

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    const savedUserInfo = localStorage.getItem('userInfo')

    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }

    if (savedUserInfo) {
      setUserInfo(JSON.parse(savedUserInfo))
    }

    setLoading(false)
  }, [])

  const buildQuestions = useCallback((pool) => {
    if (!Array.isArray(pool) || pool.length === 0) return []
    const subset = pool.length <= 5 ? pool : shuffleAndTake(pool, 5)
    return subset.map((q, idx) => ({
      ...q,
      displayIndex: idx + 1,
      correct_answer: typeof q.correct_answer === 'string' ? parseInt(q.correct_answer, 10) : q.correct_answer
    }))
  }, [])

  const getUserId = useCallback(() => {
    return userInfo?.sub || userInfo?.username || userInfo?.email || user?.user_id || 'test-user-id'
  }, [userInfo, user])

  const fetchWrongAnswers = useCallback(async () => {
    setFetching(true)
    setError(null)
    setSubmitted(false)
    setAnswers({})
    setScore(0)

    try {
      const payload = {
        user_id: getUserId(),
        question_limit: 5
      }

      const response = await fetch(REVIEW_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Không thể tải dữ liệu (mã ${response.status})`)
      }

      const data = await response.json()
      const body = data.body ? (typeof data.body === 'string' ? JSON.parse(data.body) : data.body) : data

      const pool = Array.isArray(body.review_quiz) ? body.review_quiz : []
      const samples = Array.isArray(body.wrong_questions_sample) ? body.wrong_questions_sample : []

      setQuestionPool(pool)
      setQuestions(buildQuestions(pool))
      setWrongSamples(samples)
      setMeta({
        totalWrong: body.total_wrong_questions,
        breakdown: body.question_types_breakdown,
        sampleSize: body.wrong_questions_sample?.length || 0
      })
      setLastUpdated(new Date())
    } catch (err) {
      setError(err.message || 'Đã có lỗi xảy ra khi tải câu hỏi')
      setQuestionPool([])
      setQuestions([])
      setMeta(null)
    } finally {
      setFetching(false)
    }
  }, [buildQuestions, getUserId])

  useEffect(() => {
    if (loading) return
    if (user) {
      fetchWrongAnswers()
    }
  }, [loading, user, fetchWrongAnswers])

  const answeredCount = useMemo(
    () => questions.filter(q => answers[q.question_id] !== undefined).length,
    [answers, questions]
  )

  const handleSelect = (questionId, optionIdx) => {
    if (submitted) return
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionIdx
    }))
  }

  const handleSubmit = () => {
    if (!questions.length) return
    const newScore = questions.reduce((total, q) => {
      const selected = answers[q.question_id]
      return total + (selected === q.correct_answer ? 1 : 0)
    }, 0)
    setScore(newScore)
    setSubmitted(true)
  }

  const handleReshuffle = () => {
    if (!questionPool.length) return
    setQuestions(buildQuestions(questionPool))
    setAnswers({})
    setSubmitted(false)
    setScore(0)
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
    <div className="review-page">
      <TopBar userInfo={userInfo} />

      <main className="review-main">
        <div className="container">
          <header className="review-header">
            <div>
              <p className="review-eyebrow">Ôn tập câu sai</p>
              <h1>Review Quiz thông minh</h1>
              <p className="review-lead">
                Tự động tạo 5 câu hỏi luyện tập dựa trên những câu bạn thường trả lời sai. Kiểm tra nhanh, xem giải thích và cải thiện từng ngày.
              </p>
              <div className="review-tabs">
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'quiz' ? 'active' : ''}`}
                  onClick={() => setActiveTab('quiz')}
                >
                  Bộ câu hỏi luyện tập
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'samples' ? 'active' : ''}`}
                  onClick={() => setActiveTab('samples')}
                >
                  Danh sách câu sai ({wrongSamples.length})
                </button>
              </div>
              {meta && (
                <div className="review-metrics">
                  <div className="metric-pill">
                    <span className="metric-label">Tổng số câu sai ghi nhận</span>
                    <span className="metric-value">{meta.totalWrong ?? '-'}</span>
                  </div>
                  <div className="metric-pill">
                    <span className="metric-label">Phân bố</span>
                    <span className="metric-value">
                      Fill short: {meta.breakdown?.fill_short ?? 0} · Reading: {meta.breakdown?.reading ?? 0} · Rearrange: {meta.breakdown?.rearrange ?? 0}
                    </span>
                  </div>
                  <div className="metric-pill">
                    <span className="metric-label">Bộ mẫu</span>
                    <span className="metric-value">{meta.sampleSize} câu gần nhất</span>
                  </div>
                </div>
              )}
            </div>
            <div className="review-actions">
              <button
                className="btn-outline"
                onClick={handleReshuffle}
                disabled={!questionPool.length || fetching}
              >
                Đổi bộ câu hỏi
              </button>
              <button
                className="btn-primary"
                onClick={fetchWrongAnswers}
                disabled={fetching}
              >
                {fetching ? 'Đang tải...' : 'Lấy dữ liệu mới'}
              </button>
            </div>
          </header>

          {error && (
            <div className="review-banner error">
              <div className="banner-dot"></div>
              <div>
                <p className="banner-title">Không thể tải câu hỏi</p>
                <p className="banner-desc">{error}</p>
              </div>
            </div>
          )}

          {!error && !fetching && questions.length === 0 && activeTab === 'quiz' && (
            <div className="review-banner neutral">
              <div className="banner-dot"></div>
              <div>
                <p className="banner-title">Chưa có dữ liệu ôn tập</p>
                <p className="banner-desc">Hãy làm bài thi để hệ thống ghi nhận và gợi ý câu hỏi phù hợp.</p>
              </div>
            </div>
          )}

          {activeTab === 'quiz' && (
          <section className="review-grid">
            {fetching && (
              <div className="loading-strip">
                <div className="dot dot-1"></div>
                <div className="dot dot-2"></div>
                <div className="dot dot-3"></div>
                <span>Đang tạo bộ câu hỏi...</span>
              </div>
            )}
            {!fetching && questions.map((question, idx) => {
              const selected = answers[question.question_id]
              const isCorrect = submitted && selected === question.correct_answer
              const showAnswer = submitted

              return (
                <article key={question.question_id} className="review-card" id={`review-${idx + 1}`}>
                  <div className="review-card-head">
                    <div className="pill">Câu {idx + 1}</div>
                    <span className="tag">{question.question_type || 'fill_short'}</span>
                  </div>
                  <h3 className="review-question">{question.question}</h3>
                  <div className="options-grid">
                    {question.options.map((opt, optIdx) => {
                      const isSelected = selected === optIdx
                      const isRight = showAnswer && optIdx === question.correct_answer
                      const isWrongChoice = showAnswer && isSelected && optIdx !== question.correct_answer

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          className={`option-chip ${isSelected ? 'selected' : ''} ${isRight ? 'correct' : ''} ${isWrongChoice ? 'wrong' : ''}`}
                          onClick={() => handleSelect(question.question_id, optIdx)}
                          disabled={submitted}
                        >
                          <span className="option-index">{String.fromCharCode(65 + optIdx)}.</span>
                          <span>{opt}</span>
                        </button>
                      )
                    })}
                  </div>

                  {showAnswer && (
                    <div className={`review-explanation ${isCorrect ? 'good' : 'bad'}`}>
                      <p className="explanation-title">
                        {isCorrect ? 'Chính xác!' : 'Đáp án đúng: '}{!isCorrect && question.options[question.correct_answer]}
                      </p>
                      <p className="explanation-body">{question.explanation}</p>
                    </div>
                  )}
                </article>
              )
            })}
          </section>
          )}

          {activeTab === 'samples' && (
            <section className="sample-list">
              {wrongSamples.length === 0 && !fetching && (
                <div className="review-banner neutral">
                  <div className="banner-dot"></div>
                  <div>
                    <p className="banner-title">Chưa có câu sai để review</p>
                    <p className="banner-desc">Làm thêm bài thi để ghi nhận dữ liệu.</p>
                  </div>
                </div>
              )}

              {wrongSamples.map((item, idx) => {
                const correctLabel = typeof item.correct_answer === 'number'
                  ? String.fromCharCode(65 + item.correct_answer)
                  : item.correct_answer
                const userChoiceLabel = typeof item.user_choice === 'number'
                  ? String.fromCharCode(65 + item.user_choice)
                  : item.user_choice

                return (
                  <article key={item.question_id || idx} className="sample-card">
                    <header className="sample-head">
                      <div className="pill">Câu sai {idx + 1}</div>
                      <span className="tag">{item.question_type}</span>
                    </header>
                    {item.context && (
                      <p className="sample-context">{item.context}</p>
                    )}
                    <p className="sample-detail">{item.question_detail || item.question}</p>
                    <div className="options-grid sample-options">
                      {item.options?.map((opt, optIdx) => {
                        const label = String.fromCharCode(65 + optIdx)
                        const isCorrect = label === correctLabel
                        const isWrongChoice = userChoiceLabel && label === userChoiceLabel && label !== correctLabel
                        return (
                          <div key={optIdx} className={`option-chip sample ${isCorrect ? 'correct' : ''} ${isWrongChoice ? 'wrong' : ''}`}>
                            <span className="option-index">{label}.</span>
                            <span>{opt}</span>
                            {isCorrect && <span className="badge-correct">Đáp án</span>}
                            {isWrongChoice && <span className="badge-wrong">Bạn chọn</span>}
                          </div>
                        )
                      })}
                    </div>
                  </article>
                )
              })}
            </section>
          )}

          {activeTab === 'quiz' && (
            <footer className="review-footer">
              <div className="footer-left">
                <p className="answered-counter">Đã trả lời {answeredCount}/{questions.length || 5} câu</p>
                {submitted && (
                  <p className="score-pill">
                    Điểm: {score}/{questions.length}
                  </p>
                )}
                {lastUpdated && <p className="timestamp">Cập nhật: {lastUpdated.toLocaleTimeString()}</p>}
              </div>
              <div className="footer-actions">
                <button
                  className="btn-outline"
                  onClick={handleReshuffle}
                  disabled={!questionPool.length || fetching}
                >
                  Tạo bộ khác
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSubmit}
                  disabled={!questions.length || fetching}
                >
                  {submitted ? 'Đã chấm' : 'Nộp bài'}
                </button>
              </div>
            </footer>
          )}
        </div>
      </main>
    </div>
  )
}
