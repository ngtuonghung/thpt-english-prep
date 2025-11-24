import { useMemo } from 'react'
import './QuestionsList.css'

function QuestionsList({ allQuestions, answers, onQuestionClick }) {
  // Group questions for better organization (optional)
  const questionCount = useMemo(() => {
    return {
      total: allQuestions.length,
      answered: Object.keys(answers).length
    }
  }, [allQuestions, answers])

  return (
    <div className="questions-list-widget">
      <div className="questions-list-header">
        <h3 className="questions-list-title">Danh sách câu hỏi</h3>
        <div className="questions-list-stats">
          <span className="stat-answered">{questionCount.answered}</span>
          <span className="stat-separator">/</span>
          <span className="stat-total">{questionCount.total}</span>
        </div>
      </div>
      <div className="questions-grid">
        {allQuestions.map(q => (
          <button
            key={q.id}
            onClick={() => onQuestionClick(q.num)}
            className={`question-btn ${answers[q.id] ? 'answered' : ''}`}
            title={`Câu ${q.num}${answers[q.id] ? ` - Đã chọn: ${answers[q.id]}` : ''}`}
          >
            {q.num}
          </button>
        ))}
      </div>
    </div>
  )
}

export default QuestionsList
