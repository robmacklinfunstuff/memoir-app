import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MemoirSession } from '../types'

interface Props {
  onResume: (sessionId: string) => void
}

export default function SessionHistory({ onResume }: Props) {
  const [sessions, setSessions] = useState<MemoirSession[]>([])
  const [loading, setLoading] = useState(true)
  const [totalWords, setTotalWords] = useState(0)
  const [totalAnswers, setTotalAnswers] = useState(0)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: sess } = await supabase
      .from('memoir_sessions')
      .select('*')
      .order('started_at', { ascending: false })

    if (sess) setSessions(sess)

    const { data: answers } = await supabase.from('memoir_answers').select('answer')
    if (answers) {
      setTotalAnswers(answers.length)
      setTotalWords(answers.reduce((sum, a) => sum + a.answer.split(/\s+/).length, 0))
    }
    setLoading(false)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.title}>Session history</div>
      </div>

      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statNum}>{sessions.length}</div>
          <div style={s.statLabel}>Sessions</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statNum}>{totalAnswers}</div>
          <div style={s.statLabel}>Total answers</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statNum}>{totalWords.toLocaleString()}</div>
          <div style={s.statLabel}>Words captured</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statNum}>{Math.round(totalWords / 250)}</div>
          <div style={s.statLabel}>Est. pages</div>
        </div>
      </div>

      {loading && <div style={s.empty}>Loading...</div>}

      {!loading && sessions.length === 0 && (
        <div style={s.empty}>No sessions yet. Start an interview to begin.</div>
      )}

      <div style={s.sessionList}>
        {sessions.map((sess, i) => (
          <div key={sess.id} style={s.sessionCard}>
            <div style={s.sessionHeader}>
              <div>
                <div style={s.sessionTitle}>Session {sessions.length - i}</div>
                <div style={s.sessionDate}>{formatDate(sess.started_at || '')}</div>
              </div>
              <div style={s.sessionRight}>
                <div style={s.sessionCount}>{sess.total_answers} answers</div>
                <button style={s.resumeBtn} onClick={() => onResume(sess.id!)}>Resume →</button>
              </div>
            </div>
            {sess.session_summary && (
              <div style={s.sessionSummary}>{sess.session_summary}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 780 },
  header: { marginBottom: '1.5rem' },
  title: { fontSize: 22, fontWeight: 500, color: '#e8e8e8' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '2rem' },
  statCard: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '1rem', textAlign: 'center' },
  statNum: { fontSize: 24, fontWeight: 500, color: '#e8e8e8', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#666' },
  empty: { fontSize: 15, color: '#666', padding: '2rem', background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a' },
  sessionList: { display: 'flex', flexDirection: 'column', gap: 10 },
  sessionCard: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '1.25rem' },
  sessionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  sessionTitle: { fontSize: 15, fontWeight: 500, color: '#e8e8e8', marginBottom: 2 },
  sessionDate: { fontSize: 13, color: '#666' },
  sessionRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 },
  sessionCount: { fontSize: 13, color: '#888' },
  resumeBtn: { padding: '6px 12px', background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 6, color: '#aaa', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  sessionSummary: { marginTop: 10, fontSize: 13, color: '#888', lineHeight: 1.6, borderTop: '1px solid #222', paddingTop: 10, fontStyle: 'italic' }
}
