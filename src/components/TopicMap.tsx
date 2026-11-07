import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { generateTopicMap } from '../lib/api'
import { TopicEntry } from '../types'

export default function TopicMap() {
  const [loading, setLoading] = useState(false)
  const [topics, setTopics] = useState<TopicEntry[]>([])
  const [gaps, setGaps] = useState<string[]>([])
  const [generated, setGenerated] = useState(false)
  const [totalAnswers, setTotalAnswers] = useState(0)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true)
    setError('')
    const { data: answers } = await supabase
      .from('memoir_answers')
      .select('question, answer, topic_tags')
      .order('created_at', { ascending: true })

    if (!answers || answers.length === 0) {
      setLoading(false)
      return
    }
    setTotalAnswers(answers.length)
    try {
      const result = await generateTopicMap(answers)
      setTopics(result.topics as TopicEntry[])
      setGaps(result.gaps)
      setGenerated(true)
      await supabase.from('memoir_topic_maps').insert({
        topics_covered: result.topics,
        gaps_identified: result.gaps
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('Topic map generation failed:', e)
      setError(msg || 'Unknown error — check browser console')
    }
    setLoading(false)
  }

  const richnessColor = (r: string) =>
    r === 'rich' ? '#0a2a0a' : r === 'moderate' ? '#1a1a2a' : '#2a1a1a'
  const richnessBorder = (r: string) =>
    r === 'rich' ? '#1a4a1a' : r === 'moderate' ? '#2a2a4a' : '#4a2a2a'
  const richnessLabel = (r: string) =>
    r === 'rich' ? '#5a9a5a' : r === 'moderate' ? '#5a5a9a' : '#9a5a5a'

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <div style={s.title}>Topic Map</div>
          <div style={s.sub}>See what you've covered and what might be missing</div>
        </div>
        <button style={s.solidBtn} onClick={generate} disabled={loading}>
          {loading ? 'Analyzing...' : generated ? 'Refresh map' : 'Generate map'}
        </button>
      </div>

      {!generated && !loading && (
        <div style={s.empty}>
          Generate a topic map to see what stories and themes you've covered across all your interview sessions, and what might still be missing.
        </div>
      )}

      {loading && (
        <div style={s.empty}>Reading {totalAnswers} answers across all sessions...</div>
      )}

      {error && (
        <div style={{ ...s.empty, color: '#e24b4a', borderColor: '#3a1a1a', background: '#1a0a0a' }}>
          Error: {error}
        </div>
      )}

      {generated && (
        <>
          <div style={s.sectionTitle}>Topics covered ({topics.length})</div>
          <div style={s.topicGrid}>
            {topics.map((t, i) => (
              <div key={i} style={{ ...s.topicCard, background: richnessColor(t.richness), border: `1px solid ${richnessBorder(t.richness)}` }}>
                <div style={s.topicHeader}>
                  <div style={s.topicName}>{t.topic}</div>
                  <span style={{ ...s.richnessBadge, color: richnessLabel(t.richness) }}>{t.richness}</span>
                </div>
                <div style={s.topicSummary}>{t.summary}</div>
                <div style={s.topicCount}>{t.answer_count} answer{t.answer_count !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>

          {gaps.length > 0 && (
            <>
              <div style={{ ...s.sectionTitle, marginTop: '2rem' }}>Possible gaps ({gaps.length})</div>
              <div style={s.gapsList}>
                {gaps.map((g, i) => (
                  <div key={i} style={s.gapItem}>
                    <span style={s.gapDot}>○</span>
                    <span style={s.gapText}>{g}</span>
                  </div>
                ))}
              </div>
              <div style={s.gapHint}>These are topics that might belong in a memoir like this but haven't come up yet. Use them as prompts in your next interview session — or ignore them if they don't apply.</div>
            </>
          )}
        </>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 780 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' },
  title: { fontSize: 22, fontWeight: 500, color: '#e8e8e8', marginBottom: 4 },
  sub: { fontSize: 14, color: '#666' },
  solidBtn: { padding: '8px 18px', background: '#e8e8e8', border: 'none', borderRadius: 6, color: '#0f0f0f', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  empty: { fontSize: 15, color: '#666', lineHeight: 1.7, padding: '2rem', background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a' },
  sectionTitle: { fontSize: 12, color: '#555', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 },
  topicGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 },
  topicCard: { borderRadius: 10, padding: '1rem 1.25rem' },
  topicHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  topicName: { fontSize: 15, fontWeight: 500, color: '#e8e8e8' },
  richnessBadge: { fontSize: 11, letterSpacing: '0.04em' },
  topicSummary: { fontSize: 13, color: '#999', lineHeight: 1.6, marginBottom: 8 },
  topicCount: { fontSize: 11, color: '#666' },
  gapsList: { display: 'flex', flexDirection: 'column', gap: 8 },
  gapItem: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  gapDot: { color: '#555', flexShrink: 0, marginTop: 1 },
  gapText: { fontSize: 14, color: '#aaa', lineHeight: 1.5 },
  gapHint: { marginTop: '1.5rem', fontSize: 13, color: '#555', lineHeight: 1.6, fontStyle: 'italic' }
}
