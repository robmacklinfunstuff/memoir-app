import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { generateNextQuestion, factCheckAnswer, generateSessionSummary } from '../lib/api'
import { MemoirAnswer, MemoirSession, FactFlag } from '../types'

interface Props {
  sessionId: string | null
  setSessionId: (id: string) => void
}

type MicState = 'idle' | 'listening' | 'processing'

export default function Interview({ sessionId, setSessionId }: Props) {
  const [session, setSession] = useState<MemoirSession | null>(null)
  const [answers, setAnswers] = useState<MemoirAnswer[]>([])
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [questionLoading, setQuestionLoading] = useState(false)
  const [answerText, setAnswerText] = useState('')
  const [micState, setMicState] = useState<MicState>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [factFlags, setFactFlags] = useState<FactFlag[]>([])
  const [styleNote, setStyleNote] = useState('')
  const [showStyleInput, setShowStyleInput] = useState(false)
  const [styleNotes, setStyleNotes] = useState<string[]>([])
  const [statusMsg, setStatusMsg] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalTranscriptRef = useRef('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadOrCreateSession()
    loadStyleNotes()
  }, [])

  async function loadStyleNotes() {
    const { data } = await supabase.from('memoir_style_notes').select('note').order('created_at', { ascending: false }).limit(20)
    if (data) setStyleNotes(data.map(d => d.note))
  }

  async function loadOrCreateSession() {
    if (sessionId) {
      const { data: sess } = await supabase.from('memoir_sessions').select('*').eq('id', sessionId).single()
      const { data: ans } = await supabase.from('memoir_answers').select('*').eq('session_id', sessionId).order('question_index')
      if (sess) setSession(sess)
      if (ans) setAnswers(ans)
      await loadNextQuestion(ans || [])
      return
    }
    const { data: newSession } = await supabase.from('memoir_sessions').insert({ total_answers: 0 }).select().single()
    if (newSession) {
      setSession(newSession)
      setSessionId(newSession.id)
      await loadNextQuestion([])
    }
  }

  const loadNextQuestion = useCallback(async (currentAnswers: MemoirAnswer[]) => {
    setQuestionLoading(true)
    setAnswerText('')
    setFactFlags([])
    finalTranscriptRef.current = ''
    try {
      const recentHistory = currentAnswers.slice(-8).map(a => ({ q: a.question, a: a.answer }))
      const allTopics = Array.from(new Set(currentAnswers.flatMap(a => a.topic_tags)))
      const q = await generateNextQuestion(recentHistory, allTopics, styleNotes)
      setCurrentQuestion(q)
    } catch (e) {
      setCurrentQuestion('Tell me more — what else comes to mind when you think about that time?')
    }
    setQuestionLoading(false)
  }, [styleNotes])

  function initRecognition() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return false
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    finalTranscriptRef.current = answerText

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscriptRef.current += e.results[i][0].transcript + ' '
        } else {
          interim += e.results[i][0].transcript
        }
      }
      const combined = finalTranscriptRef.current + interim
      setAnswerText(combined)
      if (textareaRef.current) {
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight
      }
    }

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'not-allowed') setStatusMsg('Microphone access denied. Check browser settings.')
      setMicState('idle')
      recognitionRef.current = null
    }

    rec.onend = () => {
      if (micState === 'listening') rec.start()
    }

    recognitionRef.current = rec
    return true
  }

  function toggleMic() {
    if (micState === 'listening') {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      setMicState('idle')
      setStatusMsg('Recording stopped. Edit if needed, then submit.')
      return
    }
    const ok = initRecognition()
    if (!ok) { setStatusMsg('Speech recognition not supported. Please use Chrome or Edge.'); return }
    setMicState('listening')
    setStatusMsg('Listening...')
    recognitionRef.current?.start()
  }

  async function submitAnswer() {
    const text = answerText.trim()
    if (!text || !session || !currentQuestion) return
    if (micState === 'listening') { recognitionRef.current?.stop(); setMicState('idle') }
    setSubmitting(true)
    setStatusMsg('Saving...')

    const flags = await factCheckAnswer(text)
    setFactFlags(flags)

    const newAnswer: MemoirAnswer = {
      session_id: session.id!,
      question: currentQuestion,
      answer: text,
      topic_tags: [],
      fact_flags: flags,
      question_index: answers.length
    }

    const { data: saved } = await supabase.from('memoir_answers').insert(newAnswer).select().single()
    const updatedAnswers = [...answers, saved || newAnswer]
    setAnswers(updatedAnswers)

    await supabase.from('memoir_sessions').update({
      total_answers: updatedAnswers.length,
      last_active: new Date().toISOString()
    }).eq('id', session.id)

    setStatusMsg('')
    setSubmitting(false)
    await loadNextQuestion(updatedAnswers)
  }

  async function endSession() {
    if (!session || answers.length === 0) return
    setStatusMsg('Saving session summary...')
    const summary = await generateSessionSummary(answers.slice(-20).map(a => ({ question: a.question, answer: a.answer })))
    await supabase.from('memoir_sessions').update({ session_summary: summary, last_active: new Date().toISOString() }).eq('id', session.id)
    setStatusMsg(`Session saved. Covered: ${summary}`)
  }

  async function saveStyleNote() {
    if (!styleNote.trim()) return
    await supabase.from('memoir_style_notes').insert({ note: styleNote.trim() })
    setStyleNotes(prev => [styleNote.trim(), ...prev])
    setStyleNote('')
    setShowStyleInput(false)
    setStatusMsg('Style note saved — AI will apply it from now on.')
    setTimeout(() => setStatusMsg(''), 3000)
  }

  const wordCount = answerText.trim() ? answerText.trim().split(/\s+/).length : 0
  const totalWords = answers.reduce((sum, a) => sum + a.answer.split(/\s+/).length, 0)

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <div style={s.sessionLabel}>Session {session?.id?.slice(0, 8) || '...'}</div>
          <div style={s.stats}>{answers.length} answers · {totalWords.toLocaleString()} words captured</div>
        </div>
        <div style={s.headerBtns}>
          <button style={s.ghostBtn} onClick={() => setShowStyleInput(!showStyleInput)}>+ Style note</button>
          <button style={s.ghostBtn} onClick={endSession}>End session</button>
        </div>
      </div>

      {showStyleInput && (
        <div style={s.styleBox}>
          <div style={s.styleLabel}>Give the AI a direction or style note</div>
          <div style={s.styleHint}>e.g. "Ask me more about the people I met" · "Be funnier" · "Skip ahead to Iraq" · "Dig into that last story more"</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={s.styleInput}
              value={styleNote}
              onChange={e => setStyleNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveStyleNote()}
              placeholder="Your direction..."
              autoFocus
            />
            <button style={s.solidBtn} onClick={saveStyleNote}>Save</button>
          </div>
          {styleNotes.length > 0 && (
            <div style={s.existingNotes}>
              Active notes: {styleNotes.slice(0, 3).map((n, i) => <span key={i} style={s.noteChip}>{n}</span>)}
            </div>
          )}
        </div>
      )}

      <div style={s.questionCard}>
        <div style={s.questionLabel}>Question {answers.length + 1}</div>
        {questionLoading
          ? <div style={s.questionLoading}>Thinking<span style={s.dot}>...</span></div>
          : <div style={s.questionText}>{currentQuestion}</div>
        }
      </div>

      <div style={s.micRow}>
        <button
          style={{ ...s.micBtn, ...(micState === 'listening' ? s.micBtnActive : {}) }}
          onClick={toggleMic}
          disabled={questionLoading}
          title={micState === 'listening' ? 'Click to stop recording' : 'Click to speak'}
        >
          {micState === 'listening' ? '⏹' : '🎙'}
        </button>
        <div style={s.micStatus}>
          {micState === 'listening'
            ? <span style={{ color: '#e24b4a' }}>Recording — speak naturally, click ⏹ when done</span>
            : <span style={{ color: '#888' }}>Click mic to speak · or type below</span>
          }
        </div>
      </div>

      <textarea
        ref={textareaRef}
        style={s.textarea}
        value={answerText}
        onChange={e => setAnswerText(e.target.value)}
        placeholder="Your answer will appear here as you speak — or type directly..."
        rows={7}
      />

      <div style={s.answerFooter}>
        <span style={s.wordCountBadge}>{wordCount} words</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.ghostBtn} onClick={() => loadNextQuestion(answers)} disabled={questionLoading}>Skip question</button>
          <button
            style={{ ...s.solidBtn, opacity: (!answerText.trim() || submitting) ? 0.4 : 1 }}
            onClick={submitAnswer}
            disabled={!answerText.trim() || submitting}
          >
            {submitting ? 'Saving...' : 'Submit answer →'}
          </button>
        </div>
      </div>

      {factFlags.length > 0 && (
        <div style={s.flagsBox}>
          <div style={s.flagsTitle}>Fact check notes</div>
          {factFlags.map((f, i) => (
            <div key={i} style={s.flagItem}>
              <span style={{ ...s.flagBadge, background: f.status === 'check' ? '#3a2500' : f.status === 'uncertain' ? '#1a1a2a' : '#0a2a0a' }}>
                {f.status}
              </span>
              <span style={s.flagClaim}>{f.claim}</span>
              <span style={s.flagNote}>{f.note}</span>
            </div>
          ))}
        </div>
      )}

      {statusMsg && <div style={s.statusMsg}>{statusMsg}</div>}

      {answers.length > 0 && (
        <div style={s.transcript}>
          <div style={s.transcriptTitle}>This session</div>
          {[...answers].reverse().slice(0, 5).map((a, i) => (
            <div key={i} style={s.transcriptItem}>
              <div style={s.tq}>{a.question}</div>
              <div style={s.ta}>{a.answer.slice(0, 200)}{a.answer.length > 200 ? '...' : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 780 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  sessionLabel: { fontSize: 12, color: '#555', marginBottom: 4 },
  stats: { fontSize: 13, color: '#888' },
  headerBtns: { display: 'flex', gap: 8 },
  styleBox: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '1rem', marginBottom: '1.25rem' },
  styleLabel: { fontSize: 14, color: '#e8e8e8', fontWeight: 500, marginBottom: 4 },
  styleHint: { fontSize: 12, color: '#666', marginBottom: 10 },
  styleInput: { flex: 1, padding: '8px 12px', background: '#0f0f0f', border: '1px solid #333', borderRadius: 6, color: '#e8e8e8', fontSize: 14, fontFamily: 'inherit', outline: 'none' },
  existingNotes: { marginTop: 10, fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  noteChip: { background: '#252525', border: '1px solid #333', borderRadius: 4, padding: '2px 8px', color: '#aaa' },
  questionCard: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.25rem' },
  questionLabel: { fontSize: 11, color: '#555', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 },
  questionLoading: { fontSize: 17, color: '#666', fontStyle: 'italic' },
  questionText: { fontSize: 19, color: '#e8e8e8', lineHeight: 1.6, fontWeight: 500 },
  dot: { animation: 'none' },
  micRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: '0.75rem' },
  micBtn: { width: 48, height: 48, borderRadius: '50%', border: '1px solid #333', background: '#1a1a1a', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 },
  micBtnActive: { background: '#3a0000', borderColor: '#e24b4a', boxShadow: '0 0 0 4px rgba(226,75,74,0.15)' },
  micStatus: { fontSize: 13 },
  textarea: { width: '100%', minHeight: 160, padding: '14px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, color: '#e8e8e8', fontSize: 16, fontFamily: 'inherit', lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box' },
  answerFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: '1.25rem' },
  wordCountBadge: { fontSize: 12, color: '#555' },
  ghostBtn: { padding: '7px 14px', background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  solidBtn: { padding: '7px 16px', background: '#e8e8e8', border: 'none', borderRadius: 6, color: '#0f0f0f', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  flagsBox: { background: '#1a1500', border: '1px solid #2a2000', borderRadius: 10, padding: '1rem', marginBottom: '1rem' },
  flagsTitle: { fontSize: 12, color: '#887755', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' },
  flagItem: { display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6, fontSize: 13 },
  flagBadge: { padding: '2px 6px', borderRadius: 4, fontSize: 11, color: '#aaa', flexShrink: 0, marginTop: 1 },
  flagClaim: { color: '#ccc', flex: 1 },
  flagNote: { color: '#888', fontSize: 12 },
  statusMsg: { fontSize: 13, color: '#888', padding: '8px 0', fontStyle: 'italic' },
  transcript: { marginTop: '2rem', borderTop: '1px solid #1a1a1a', paddingTop: '1.5rem' },
  transcriptTitle: { fontSize: 12, color: '#555', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 },
  transcriptItem: { marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid #1a1a1a' },
  tq: { fontSize: 13, color: '#666', fontStyle: 'italic', marginBottom: 4 },
  ta: { fontSize: 14, color: '#aaa', lineHeight: 1.6 }
}
