import { useMemo, useCallback } from 'react'
import './QuestionsContent.css'

/**
 * QuestionsContent Component
 * Renders exam questions in two modes:
 * 1. Exam mode: Interactive mode where users can select answers
 * 2. Submission mode: Results mode showing correct/incorrect answers with chat functionality
 */
function QuestionsContent({
  examData,
  answers = {},
  mode = 'exam', // 'exam' or 'submission'
  onAnswerSelect = null, // For exam mode and review mode
  onChatBubbleClick = null, // For submission mode
  activeChatQuestion = null, // For submission mode
  showResultsAlways = false, // For submission mode - always show results even if not answered
}) {
  // Render markdown helper
  const renderMarkdown = useCallback((text) => {
    if (!text) return { __html: '' }
    const html = text
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>') // Bold and Italic
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/\n/g, '<br />') // New lines
    return { __html: html }
  }, [])

  // Build flat list of all questions with full data for submission mode
  const getAllQuestionsWithData = useCallback(() => {
    if (!examData) return []

    const questions = []
    let questionNum = 1

    // Fill short groups
    if (examData.groups?.fill_short) {
      examData.groups.fill_short.forEach(group => {
        if (group.subquestions && Array.isArray(group.subquestions)) {
          group.subquestions.forEach((subq, subIdx) => {
            questions.push({
              num: questionNum++,
              id: `${group.id}-${subIdx}`,
              type: 'fill_short',
              data: subq,
              context: group.context,
              isFirstInGroup: subIdx === 0,
              groupId: group.id
            })
          })
        }
      })
    }

    // Reorder questions
    if (examData.reorder_questions) {
      examData.reorder_questions.forEach(group => {
        if (group.subquestions && Array.isArray(group.subquestions)) {
          group.subquestions.forEach((subq, subIdx) => {
            questions.push({
              num: questionNum++,
              id: `${group.id}-${subIdx}`,
              type: 'reorder',
              data: subq,
              context: group.context && group.context !== '_' ? group.context : null,
              isFirstInGroup: subIdx === 0,
              groupId: group.id
            })
          })
        }
      })
    }

    // Fill long groups
    if (examData.groups?.fill_long) {
      examData.groups.fill_long.forEach(group => {
        if (group.subquestions && Array.isArray(group.subquestions)) {
          group.subquestions.forEach((subq, subIdx) => {
            questions.push({
              num: questionNum++,
              id: `${group.id}-${subIdx}`,
              type: 'fill_long',
              data: subq,
              context: group.context,
              isFirstInGroup: subIdx === 0,
              groupId: group.id
            })
          })
        }
      })
    }

    // Reading groups
    if (examData.groups?.reading) {
      examData.groups.reading.forEach(group => {
        if (group.subquestions && Array.isArray(group.subquestions)) {
          group.subquestions.forEach((subq, subIdx) => {
            questions.push({
              num: questionNum++,
              id: `${group.id}-${subIdx}`,
              type: 'reading',
              data: subq,
              context: group.context,
              isFirstInGroup: subIdx === 0,
              groupId: group.id
            })
          })
        }
      })
    }

    return questions
  }, [examData])

  const allQuestions = useMemo(() => getAllQuestionsWithData(), [getAllQuestionsWithData])

  // Render a single question
  const renderQuestion = useCallback((question, questionData) => {
    const questionId = question.id
    const userAnswer = answers?.[questionId]
    const correctAnswer = questionData.correct_answer
    const isCorrect = userAnswer === correctAnswer
    const isEmptyAnswer = !userAnswer

    const isSubmissionMode = mode === 'submission'

    return (
      <div key={questionId} id={`question-${question.num}`} className="sub-question">
        <div className="question-header">
          <div>
            <span className="question-number">Câu {question.num}</span>
          </div>
          {isSubmissionMode && onChatBubbleClick && (
            <button
              className={`chat-bubble-btn ${activeChatQuestion === questionId ? 'active' : ''}`}
              onClick={() => onChatBubbleClick(questionId)}
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
          )}
        </div>

        {questionData.content && (
          <p
            className="question-text"
            dangerouslySetInnerHTML={renderMarkdown(questionData.content)}
          />
        )}

        <div className="options-list">
          {questionData.options.map((option, optIdx) => {
            const optionLetter = String.fromCharCode(65 + optIdx)
            const isUserAnswer = userAnswer === optionLetter
            const isCorrectAnswer = correctAnswer === optionLetter

            // Remove the first 3 characters (e.g., "A. ", "B. ", etc.) from option text
            const optionText = option.length > 3 ? option.substring(3) : option

            let optionClass = 'option-item'

            if (isSubmissionMode) {
              // Submission mode styling - show results if answered OR if showResultsAlways is true
              if (isUserAnswer && isCorrect) {
                optionClass += ' user-answer-correct'
              } else if (isUserAnswer && !isCorrect) {
                optionClass += ' user-answer-incorrect'
              }
              if ((showResultsAlways || !isEmptyAnswer) && !isCorrect && isCorrectAnswer) {
                optionClass += ' correct-answer-highlight'
              }
            } else {
              // Exam mode styling
              if (isUserAnswer) {
                optionClass += ' selected'
              }
            }

            return (
              <div
                key={optIdx}
                onClick={() => onAnswerSelect && onAnswerSelect(questionId, optionLetter)}
                className={optionClass}
              >
                <span className="option-label">{optionLetter}.</span>
                <span className="option-text">{optionText}</span>
                {isSubmissionMode && (
                  <>
                    {isUserAnswer && isCorrect && (
                      <span className="option-badge correct">✓ Bạn chọn</span>
                    )}
                    {isUserAnswer && !isCorrect && (
                      <span className="option-badge incorrect">✗ Bạn chọn sai</span>
                    )}
                    {(showResultsAlways || !isEmptyAnswer) && !isCorrect && isCorrectAnswer && (
                      <span className="option-badge correct-ans">✓ Đáp án đúng</span>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Show explanation only if user has answered this question (or showResultsAlways is true) */}
        {isSubmissionMode && questionData.explanation && (showResultsAlways || !isEmptyAnswer) && (
          <div className={`explanation-box ${isCorrect ? 'explanation-correct' : 'explanation-incorrect'}`}>
            <div className="explanation-title">
              {isCorrect ? '✓ Giải thích' : '✗ Giải thích'}
            </div>
            <div
              className="explanation-text"
              dangerouslySetInnerHTML={renderMarkdown(questionData.explanation)}
            />
          </div>
        )}
      </div>
    )
  }, [answers, mode, onAnswerSelect, onChatBubbleClick, activeChatQuestion, renderMarkdown])

  // Group questions by context for rendering
  const renderQuestionsWithContext = useCallback((questions) => {
    const groupedQuestions = []
    let currentGroup = null

    questions.forEach(question => {
      if (question.isFirstInGroup) {
        if (currentGroup) {
          groupedQuestions.push(currentGroup)
        }
        currentGroup = {
          context: question.context,
          type: question.type,
          groupId: question.groupId,
          questions: [question]
        }
      } else if (currentGroup) {
        currentGroup.questions.push(question)
      } else {
        // Shouldn't happen, but handle it
        currentGroup = {
          context: null,
          type: question.type,
          groupId: question.groupId,
          questions: [question]
        }
      }
    })

    if (currentGroup) {
      groupedQuestions.push(currentGroup)
    }

    return groupedQuestions.map((group, groupIdx) => (
      <div key={`group-${group.groupId || groupIdx}`} className="question-group">
        {group.context && (
          <div className={`group-context ${group.type === 'reading' ? 'reading-context' : ''}`}>
            <p className="context-text" dangerouslySetInnerHTML={renderMarkdown(group.context)} />
          </div>
        )}
        {group.questions.map(question => renderQuestion(question, question.data))}
      </div>
    ))
  }, [renderMarkdown, renderQuestion])

  // Separate questions by type for section rendering
  const questionsByType = useMemo(() => {
    const types = {
      fill_short: [],
      reorder: [],
      fill_long: [],
      reading: []
    }

    allQuestions.forEach(q => {
      if (types[q.type]) {
        types[q.type].push(q)
      }
    })

    return types
  }, [allQuestions])

  if (!examData) return null

  return (
    <div className="questions-content">
      {/* Fill Short Groups - Phần 1 */}
      {questionsByType.fill_short.length > 0 && (
        <div className="question-section">
          <h2 className="section-title">
            <span className="section-number">Phần 1</span>
            Điền từ ngắn
          </h2>
          {renderQuestionsWithContext(questionsByType.fill_short)}
        </div>
      )}

      {/* Reorder Questions - Phần 2 */}
      {questionsByType.reorder.length > 0 && (
        <div className="question-section">
          <h2 className="section-title">
            <span className="section-number">Phần 2</span>
            Sắp xếp câu
          </h2>
          {renderQuestionsWithContext(questionsByType.reorder)}
        </div>
      )}

      {/* Fill Long Groups - Phần 3 */}
      {questionsByType.fill_long.length > 0 && (
        <div className="question-section">
          <h2 className="section-title">
            <span className="section-number">Phần 3</span>
            Điền câu
          </h2>
          {renderQuestionsWithContext(questionsByType.fill_long)}
        </div>
      )}

      {/* Reading Groups - Phần 4 */}
      {questionsByType.reading.length > 0 && (
        <div className="question-section">
          <h2 className="section-title">
            <span className="section-number">Phần 4</span>
            Đọc hiểu
          </h2>
          {renderQuestionsWithContext(questionsByType.reading)}
        </div>
      )}
    </div>
  )
}

export default QuestionsContent
