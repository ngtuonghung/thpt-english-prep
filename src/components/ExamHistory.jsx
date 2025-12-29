import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import './ExamHistory.css'

const API_BASE = 'https://d9sorihgd7.execute-api.ap-southeast-1.amazonaws.com/prod'

export default function ExamHistory({ accessToken, onLoadingChange }) {
  const navigate = useNavigate()
  const [examHistory, setExamHistory] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchExamHistory = useCallback(async () => {
    if (!accessToken) return

    setLoading(true)
    if (onLoadingChange) onLoadingChange(true)

    try {
      console.log('Fetching exam history...')
      const response = await fetch(`${API_BASE}/submission?id=-1`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      console.log('Exam history response status:', response.status)

      if (!response.ok) {
        throw new Error(`Failed to fetch exam history: ${response.status}`)
      }

      const data = await response.json()
      console.log('Exam history data:', data)

      // Handle both Lambda Proxy (direct response) and non-proxy (wrapped in body)
      const body = data.body ? (typeof data.body === 'string' ? JSON.parse(data.body) : data.body) : data
      
      setExamHistory(body.exams || [])
    } catch (err) {
      console.error('Failed to fetch exam history:', err)
    } finally {
      setLoading(false)
      if (onLoadingChange) onLoadingChange(false)
    }
  }, [accessToken, onLoadingChange])

  useEffect(() => {
    fetchExamHistory()
  }, [fetchExamHistory])

  if (loading) {
    return (
      <div className="exam-history-section">
        <h2 className="section-title">Lịch sử thi</h2>
        <div className="history-loading">
          <div className="spinner"></div>
          <p>Đang tải lịch sử...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="exam-history-section">
      <h2 className="section-title">Lịch sử thi</h2>
      {examHistory.length === 0 ? (
        <div className="no-history">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>Chưa có lịch sử thi nào</p>
        </div>
      ) : (
        <div className="history-grid">
          {examHistory.map((exam) => {
            const percentage = exam.total_questions > 0
              ? Math.round((exam.correct_count / exam.total_questions) * 100)
              : 0
            
            // Parse dates
            const startTime = exam.exam_start_time
            const finishTime = exam.exam_finish_time
            
            const startDate = new Date(startTime)
            const finishDate = new Date(finishTime)
            
            // Calculate duration
            const durationMs = finishDate.getTime() - startDate.getTime()
            const totalSeconds = Math.floor(Math.abs(durationMs) / 1000)
            const hours = Math.floor(totalSeconds / 3600)
            const minutes = Math.floor((totalSeconds % 3600) / 60)
            const seconds = totalSeconds % 60
            
            // Format as HH:MM:SS or MM:SS depending on duration
            let durationFormatted
            if (hours > 0) {
              durationFormatted = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            } else {
              durationFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`
            }
            
            const formattedStartDate = startDate.toLocaleDateString('vi-VN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            })
            const formattedStartTime = startDate.toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })
            
            const formattedFinishTime = finishDate.toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })

            return (
              <div key={exam.exam_id} className="history-card">
                <div className="history-card-header">
                  <div className="exam-id-badge">Đề #{exam.exam_id}</div>
                  <div className={`score-badge score-${percentage >= 80 ? 'excellent' : percentage >= 50 ? 'good' : 'poor'}`}>
                    {exam.correct_count}/{exam.total_questions}
                  </div>
                </div>
                <div className="history-card-body">
                  <div className="history-stat">
                    <span className="stat-label">Ngày thi:</span>
                    <span className="stat-value">{formattedStartDate}</span>
                  </div>
                  <div className="history-stat">
                    <span className="stat-label">Bắt đầu:</span>
                    <span className="stat-value">{formattedStartTime}</span>
                  </div>
                  <div className="history-stat">
                    <span className="stat-label">Kết thúc:</span>
                    <span className="stat-value">{formattedFinishTime}</span>
                  </div>
                  <div className="history-stat">
                    <span className="stat-label">Thời gian làm:</span>
                    <span className="stat-value">{durationFormatted}</span>
                  </div>
                </div>
                <div className="history-card-actions">
                  <button
                    className="btn-history-action btn-review"
                    onClick={() => navigate(`/submission?id=${exam.exam_id}`)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <span>Xem kết quả</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
