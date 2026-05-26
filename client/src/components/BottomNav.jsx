import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const HomeIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#3478F7' : '#8a8a8a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>
  </svg>
)

const ChatIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#3478F7' : '#8a8a8a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
)

const CalcIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#3478F7' : '#8a8a8a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="3" width="16" height="18" rx="2.5"/>
    <rect x="7" y="6" width="10" height="3" rx="0.8"/>
    <circle cx="8.5" cy="13" r="0.8" fill={active ? '#3478F7' : '#8a8a8a'}/>
    <circle cx="12" cy="13" r="0.8" fill={active ? '#3478F7' : '#8a8a8a'}/>
    <circle cx="15.5" cy="13" r="0.8" fill={active ? '#3478F7' : '#8a8a8a'}/>
    <circle cx="8.5" cy="17" r="0.8" fill={active ? '#3478F7' : '#8a8a8a'}/>
    <circle cx="12" cy="17" r="0.8" fill={active ? '#3478F7' : '#8a8a8a'}/>
    <circle cx="15.5" cy="17" r="0.8" fill={active ? '#3478F7' : '#8a8a8a'}/>
  </svg>
)

const UploadIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#3478F7' : '#8a8a8a'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>
  </svg>
)

export default function BottomNav({ onUploadClick }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { t } = useTranslation()

  const tabs = [
    { id: 'home',        label: t('nav_home'),        Icon: HomeIcon,   action: () => navigate('/dashboard') },
    { id: 'upload',      label: t('nav_upload'),      Icon: UploadIcon, action: onUploadClick ?? (() => navigate('/dashboard')) },
    { id: 'chat',        label: t('nav_chat'),         Icon: ChatIcon,   action: () => navigate('/dashboard') },
    { id: 'calculators', label: t('nav_calculators'), Icon: CalcIcon,   action: () => navigate('/calculators') },
  ]

  function activeTab() {
    if (pathname === '/calculators') return 'calculators'
    return 'home'
  }

  const active = activeTab()

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid #EDE9E0',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex justify-around items-end px-2 pt-2 pb-3">
        {tabs.map(({ id, label, Icon, action }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={action}
              className="flex-1 flex flex-col items-center gap-1 min-h-[48px] bg-transparent border-none cursor-pointer"
              style={{ color: isActive ? '#3478F7' : '#8a8a8a' }}
            >
              <div
                className="flex items-center justify-center rounded-full transition-all duration-200"
                style={{
                  width: 48,
                  height: 30,
                  background: isActive ? '#EEF4FF' : 'transparent',
                }}
              >
                <Icon active={isActive} />
              </div>
              <span className="text-[11px] font-semibold leading-none">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
