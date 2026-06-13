import { useState, useEffect } from 'react'
import Interview from './components/Interview'
import TopicMap from './components/TopicMap'
import Manuscript from './components/Manuscript'
import SessionHistory from './components/SessionHistory'
import { AppScreen } from './types'

const PIN = import.meta.env.VITE_APP_PIN || '1944'

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [screen, setScreen] = useState<AppScreen>('interview')
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    const saved = sessionStorage.getItem('memoir_authed')
    if (saved === 'yes') setAuthed(true)
  }, [])

  function handlePin() {
    if (pinInput === PIN) {
      setAuthed(true)
      sessionStorage.setItem('memoir_authed', 'yes')
    } else {
      setPinError(true)
      setPinInput('')
      setTimeout(() => setPinError(false), 2000)
    }
  }

  if (!authed) {
    return (
      <div style={styles.pinScreen}>
        <div style={styles.pinCard}>
          <div style={styles.pinTitle}>Memoir Studio</div>
          <div style={styles.pinSub}>Enter PIN to continue</div>
          <input
            style={{ ...styles.pinInput, borderColor: pinError ? '#e24b4a' : '#333' }}
            type="password"
            value={pinInput}
            onChange={e => setPinInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePin()}
            placeholder="PIN"
            autoFocus
            maxLength={8}
          />
          {pinError && <div style={styles.pinErr}>Incorrect PIN</div>}
          <button style={styles.pinBtn} onClick={handlePin}>Enter</button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.shell}>
      <nav style={styles.nav}>
        <div style={styles.navTitle}>Memoir Studio</div>
        <div style={styles.navLinks}>
          {(['interview', 'topic_map', 'manuscript', 'history'] as AppScreen[]).map(s => (
            <button
              key={s}
              style={{ ...styles.navBtn, ...(screen === s ? styles.navBtnActive : {}) }}
              onClick={() => setScreen(s)}
            >
              {s === 'interview' ? 'Interview' :
               s === 'topic_map' ? 'Topic Map' :
               s === 'manuscript' ? 'Manuscript' : 'History'}
            </button>
          ))}
        </div>
      </nav>

      <main style={styles.main}>
        {screen === 'interview' && (
          <Interview sessionId={sessionId} setSessionId={setSessionId} />
        )}
        {screen === 'topic_map' && <TopicMap />}
        {screen === 'manuscript' && <Manuscript />}
        {screen === 'history' && <SessionHistory onResume={(id) => { setSessionId(id); setScreen('interview') }} />}
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  pinScreen: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0f0f0f'
  },
  pinCard: {
    background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16,
    padding: '2.5rem', textAlign: 'center', minWidth: 280
  },
  pinTitle: { fontSize: 22, fontWeight: 500, color: '#e8e8e8', marginBottom: 8 },
  pinSub: { fontSize: 14, color: '#888', marginBottom: 24 },
  pinInput: {
    width: '100%', padding: '10px 14px', background: '#0f0f0f', border: '1px solid #333',
    borderRadius: 8, color: '#e8e8e8', fontSize: 18, textAlign: 'center',
    letterSpacing: 6, marginBottom: 8, outline: 'none', fontFamily: 'inherit'
  },
  pinErr: { fontSize: 13, color: '#e24b4a', marginBottom: 8 },
  pinBtn: {
    width: '100%', padding: '10px', background: '#e8e8e8', color: '#0f0f0f',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500,
    cursor: 'pointer', marginTop: 8, fontFamily: 'inherit'
  },
  shell: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 2rem', height: 56, background: '#1a1a1a',
    borderBottom: '1px solid #2a2a2a', position: 'sticky', top: 0, zIndex: 10
  },
  navTitle: { fontSize: 15, fontWeight: 500, color: '#e8e8e8' },
  navLinks: { display: 'flex', gap: 4 },
  navBtn: {
    padding: '6px 14px', background: 'transparent', border: '1px solid transparent',
    borderRadius: 6, color: '#888', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit'
  },
  navBtnActive: { border: '1px solid #333', color: '#e8e8e8', background: '#252525' },
  main: { flex: 1, padding: '2rem', maxWidth: 860, margin: '0 auto', width: '100%' }
}
