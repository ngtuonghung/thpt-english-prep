import { useMemo } from 'react'
import './QuestionsList.css'

function QuestionsList({ allQuestions, answers, onQuestionClick, showResults }) {
  // Group questions for better organization (optional)
  const questionCount = useMemo(() => {
    return {
      total: allQuestions.length,
      answered: Object.keys(answers).length
    }
  }, [allQuestions, answers])

  // Get button class based on answer status
  const getButtonClass = (question) => {
    const userAnswer = answers[question.id]
    
    if (!showResults) {
      // Exam mode: just show if answered
      return userAnswer ? 'answered' : ''
    }
    
    // Submission mode: show correct/incorrect
    if (!userAnswer) {
      return 'not-answered'
    }
    
    const correctAnswer = question.data?.correct_answer
    const isCorrect = userAnswer === correctAnswer
    
    return isCorrect ? 'correct' : 'incorrect'
  }

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
            className={`question-btn ${getButtonClass(q)}`}
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
