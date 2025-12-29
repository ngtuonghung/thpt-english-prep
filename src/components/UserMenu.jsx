import { useState, useEffect, useRef } from 'react'
import './UserMenu.css'

const COGNITO_DOMAIN = 'https://ap-southeast-11dmhyj0by.auth.ap-southeast-1.amazoncognito.com'
const CLIENT_ID = '2iokj9vleie1jc2b2tt9eu11n4'

export default function UserMenu({ userInfo, hideLogout = false }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const profileMenuRef = useRef(null)

  // Handle click outside to close profile menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false)
      }
    }

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfileMenu])

  const handleLogout = () => {
    // Clear all localStorage
    localStorage.clear()

    // Clear all sessionStorage (exam data)
    sessionStorage.clear()

    // Redirect to Cognito logout
    const logoutUrl = `${COGNITO_DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=${encodeURIComponent(window.location.origin)}`
    console.log('Logout URL:', logoutUrl)
    window.location.href = logoutUrl
  }

  const getInitials = (name) => {
    if (!name) return '👤'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <div className="user-menu" ref={profileMenuRef}>
      <button
        className="user-profile-button"
        onClick={() => setShowProfileMenu(!showProfileMenu)}
      >
        <div className="user-avatar">
          {userInfo?.picture ? (
            <img src={userInfo.picture} alt={userInfo.username || 'User'} className="user-avatar-img" />
          ) : (
            <span className="user-avatar-initials">
              {getInitials(userInfo?.username || userInfo?.name || userInfo?.email)}
            </span>
          )}
        </div>
        <span className="user-name">{userInfo?.username || userInfo?.name || userInfo?.email?.split('@')[0] || 'User'}</span>
        <svg className={`dropdown-arrow ${showProfileMenu ? 'open' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {showProfileMenu && (
        <div className="profile-dropdown">
          <div className="profile-dropdown-header">
            <div className="profile-dropdown-avatar">
              {userInfo?.picture ? (
                <img src={userInfo.picture} alt={userInfo.username || 'User'} className="profile-dropdown-avatar-img" />
              ) : (
                <span className="profile-dropdown-avatar-initials">
                  {getInitials(userInfo?.username || userInfo?.name || userInfo?.email)}
                </span>
              )}
            </div>
            <div className="profile-dropdown-info">
              <h3 className="profile-dropdown-name">{userInfo?.username || userInfo?.name || 'Người dùng'}</h3>
              <p className="profile-dropdown-email">{userInfo?.email || 'Không có email'}</p>
            </div>
          </div>

          <div className="profile-dropdown-divider"></div>

          <div className="profile-dropdown-details">
            <div className="profile-detail-item">
              <span className="profile-detail-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                Email
              </span>
              <span className="profile-detail-value">{userInfo?.email || 'N/A'}</span>
            </div>
            {userInfo?.phone_number && (
              <div className="profile-detail-item">
                <span className="profile-detail-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                  </svg>
                  Số điện thoại
                </span>
                <span className="profile-detail-value">{userInfo.phone_number}</span>
              </div>
            )}
            {userInfo?.sub && (
              <div className="profile-detail-item">
                <span className="profile-detail-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  ID người dùng
                </span>
                <span className="profile-detail-value profile-detail-truncate">{userInfo.sub}</span>
              </div>
            )}
            {userInfo?.groups && userInfo.groups.length > 0 && (
              <div className="profile-detail-item">
                <span className="profile-detail-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  Nhóm
                </span>
                <span className="profile-detail-value">
                  {userInfo.groups.map(group => (
                    <span key={group} className="profile-badge">{group}</span>
                  ))}
                </span>
              </div>
            )}
            {userInfo?.email_verified !== undefined && (
              <div className="profile-detail-item">
                <span className="profile-detail-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Email đã xác minh
                </span>
                <span className="profile-detail-value">{userInfo.email_verified ? 'Có' : 'Không'}</span>
              </div>
            )}
          </div>

          {!hideLogout && (
            <>
              <div className="profile-dropdown-divider"></div>

              <div className="profile-dropdown-actions">
                <button onClick={handleLogout} className="btn-logout-dropdown">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  <span>Đăng xuất</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
