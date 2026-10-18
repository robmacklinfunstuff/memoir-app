import { useState } from 'react'
import Interview from './components/Interview'
import TopicMap from './components/TopicMap'
import Manuscript from './components/Manuscript'
import SessionHistory from './components/SessionHistory'
import { AppScreen } from './types'

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('interview')
  const [sessionId, setSessionId] = useState<string | null>(null)

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
