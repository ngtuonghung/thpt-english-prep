import { useMemo, useCallback, useState, useEffect } from 'react'
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
  // State to track streaming explanations
  const [streamingExplanations, setStreamingExplanations] = useState({})

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

  // Stream explanation effect
  useEffect(() => {
    const isSubmissionMode = mode === 'submission'
    if (!isSubmissionMode) return

    allQuestions.forEach(question => {
      const questionId = question.id
      const userAnswer = answers?.[questionId]
      const hasExplanation = question.data?.explanation
      const isEmptyAnswer = !userAnswer
      const shouldShowExplanation = hasExplanation && (showResultsAlways || !isEmptyAnswer)

      // Only stream if explanation should be shown and hasn't been streamed yet
      if (shouldShowExplanation && !streamingExplanations[questionId]) {
        const fullText = question.data.explanation
        const words = fullText.split(' ')
        let currentIndex = 0

        // Mark as streaming
        setStreamingExplanations(prev => ({
          ...prev,
          [questionId]: { text: '', streaming: true, fullText }
        }))

        const streamInterval = setInterval(() => {
          if (currentIndex < words.length) {
            setStreamingExplanations(prev => {
              const current = prev[questionId]
              if (!current) return prev

              const newText = words.slice(0, currentIndex + 1).join(' ')
              return {
                ...prev,
                [questionId]: {
                  ...current,
                  text: newText
                }
              }
            })
            currentIndex++
          } else {
            // Streaming complete
            clearInterval(streamInterval)
            setStreamingExplanations(prev => ({
              ...prev,
              [questionId]: {
                text: fullText,
                streaming: false,
                fullText
              }
            }))
          }
        }, 30) // 30ms per word for smooth animation

        return () => clearInterval(streamInterval)
      }
    })
  }, [allQuestions, answers, mode, showResultsAlways, streamingExplanations])

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
        {isSubmissionMode && onChatBubbleClick && (
          <button
            className={`chat-toggle-btn ${activeChatQuestion === questionId ? 'active' : ''}`}
            onClick={() => onChatBubbleClick(questionId)}
            title="Chat với AI về câu hỏi này"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Hỏi AI</span>
          </button>
        )}
        <div className="question-header">
          <div>
            <span className="question-number">Câu {question.num}</span>
          </div>
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
            <div className="explanation-text">
              {streamingExplanations[questionId]?.streaming ? (
                <>
                  <span dangerouslySetInnerHTML={renderMarkdown(streamingExplanations[questionId]?.text || '')} />
                  <span className="streaming-cursor">▊</span>
                </>
              ) : (
                <span dangerouslySetInnerHTML={renderMarkdown(streamingExplanations[questionId]?.text || questionData.explanation)} />
              )}
            </div>
          </div>
        )}
      </div>
    )
  }, [answers, mode, onAnswerSelect, onChatBubbleClick, activeChatQuestion, renderMarkdown, showResultsAlways, streamingExplanations])

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
            Điền từ ngắn
          </h2>
          {renderQuestionsWithContext(questionsByType.fill_short)}
        </div>
      )}

      {/* Reorder Questions - Phần 2 */}
      {questionsByType.reorder.length > 0 && (
        <div className="question-section">
          <h2 className="section-title">
            Sắp xếp câu
          </h2>
          {renderQuestionsWithContext(questionsByType.reorder)}
        </div>
      )}

      {/* Fill Long Groups - Phần 3 */}
      {questionsByType.fill_long.length > 0 && (
        <div className="question-section">
          <h2 className="section-title">
            Điền câu
          </h2>
          {renderQuestionsWithContext(questionsByType.fill_long)}
        </div>
      )}

      {/* Reading Groups - Phần 4 */}
      {questionsByType.reading.length > 0 && (
        <div className="question-section">
          <h2 className="section-title">
            Đọc hiểu
          </h2>
          {renderQuestionsWithContext(questionsByType.reading)}
        </div>
      )}
    </div>
  )
}

export default QuestionsContent
