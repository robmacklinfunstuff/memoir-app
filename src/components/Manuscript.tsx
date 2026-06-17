import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { generateManuscript } from '../lib/api'

export default function Manuscript() {
  const [manuscript, setManuscript] = useState('')
  const [wordCount, setWordCount] = useState(0)
  const [version, setVersion] = useState(1)
  const [phase, setPhase] = useState<'rough_draft' | 'first_draft'>('rough_draft')
  const [generating, setGenerating] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [totalAnswers, setTotalAnswers] = useState(0)
  const [status, setStatus] = useState('')

  useEffect(() => { loadLatest() }, [])

  async function loadLatest() {
    const { data } = await supabase
      .from('memoir_manuscripts')
      .select('*')
      .order('version', { ascending: false })
      .limit(1)
      .single()
    if (data) {
      setManuscript(data.content)
      setWordCount(data.word_count)
      setVersion(data.version)
      setPhase(data.phase)
    }
    const { count } = await supabase.from('memoir_answers').select('*', { count: 'exact', head: true })
    setTotalAnswers(count || 0)
    setLoaded(true)
  }

  async function generate(targetPhase: 'rough_draft' | 'first_draft') {
    setGenerating(true)
    setStatus('Loading all interview answers...')

    const { data: answers } = await supabase
      .from('memoir_answers')
      .select('question, answer')
      .order('created_at', { ascending: true })

    if (!answers || answers.length === 0) {
      setStatus('No interview answers found. Complete some interview sessions first.')
      setGenerating(false)
      return
    }

    const { data: notes } = await supabase.from('memoir_style_notes').select('note').order('created_at', { ascending: false }).limit(20)
    const styleNotes = notes ? notes.map(n => n.note) : []

    setStatus(`Generating ${targetPhase === 'rough_draft' ? 'rough draft' : 'first draft'} from ${answers.length} answers — writing now, content will appear as it streams in...`)

    try {
      const content = await generateManuscript(
        answers,
        styleNotes,
        targetPhase,
        (partial) => {
          setManuscript(partial)
          setWordCount(partial.split(/\s+/).length)
        },
        (msg) => setStatus(msg)
      )
      const wc = content.split(/\s+/).length
      const newVersion = version + 1

      await supabase.from('memoir_manuscripts').insert({
        content,
        word_count: wc,
        version: newVersion,
        phase: targetPhase
      })

      setManuscript(content)
      setWordCount(wc)
      setVersion(newVersion)
      setPhase(targetPhase)
      setStatus(`Done — ${wc.toLocaleString()} words`)
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
    setGenerating(false)
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(manuscript)
    setStatus('Copied to clipboard.')
    setTimeout(() => setStatus(''), 3000)
  }

  function downloadTxt() {
    const blob = new Blob([manuscript], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `memoir-${phase}-v${version}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadHtml() {
    const chapters = manuscript.split(/\n(?=Chapter|CHAPTER|Part |PART )/)
    const toc = chapters.map((c, i) => {
      const firstLine = c.split('\n')[0].trim()
      return `<li><a href="#ch${i}">${firstLine}</a></li>`
    }).join('\n')

    const body = chapters.map((c, i) => {
      const lines = c.split('\n')
      const title = lines[0].trim()
      const rest = lines.slice(1).join('\n').trim()
      const paragraphs = rest.split(/\n\n+/).map(p =>
        p.trim() === '***' ? '<div class="scene-break">* * *</div>' : `<p>${p.trim()}</p>`
      ).join('\n')
      return `<section id="ch${i}"><h2>${title}</h2>${paragraphs}</section>`
    }).join('\n\n')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Memoir Draft v${version}</title>
<style>
  body { font-family: Georgia, serif; max-width: 680px; margin: 0 auto; padding: 2rem 1rem; line-height: 1.8; color: #222; }
  h1 { font-size: 2rem; margin-bottom: 0.5rem; }
  h2 { font-size: 1.4rem; margin-top: 3rem; margin-bottom: 1rem; }
  p { margin: 0 0 1rem; text-indent: 1.5em; }
  p:first-of-type { text-indent: 0; }
  .scene-break { text-align: center; margin: 2rem 0; color: #888; }
  nav { margin-bottom: 3rem; padding: 1rem; background: #f5f5f5; border-radius: 6px; }
  nav h3 { margin: 0 0 0.75rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; }
  nav ol { margin: 0; padding-left: 1.5rem; }
  nav li { margin-bottom: 4px; font-size: 0.9rem; }
  nav a { color: #555; }
  .meta { font-size: 0.85rem; color: #888; margin-bottom: 3rem; }
</style>
</head>
<body>
<h1>Memoir Draft</h1>
<div class="meta">Version ${version} · ${wordCount.toLocaleString()} words · ${phase.replace('_', ' ')}</div>
<nav><h3>Contents</h3><ol>${toc}</ol></nav>
${body}
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `memoir-${phase}-v${version}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <div style={s.title}>Manuscript</div>
          <div style={s.sub}>
            {manuscript
              ? `Version ${version} · ${wordCount.toLocaleString()} words · ${phase.replace('_', ' ')}`
              : `${totalAnswers} answers ready · no draft yet`}
          </div>
        </div>
        <div style={s.btnRow}>
          {manuscript && (
            <>
              <button style={s.ghostBtn} onClick={copyToClipboard}>Copy</button>
              <button style={s.ghostBtn} onClick={downloadTxt}>Download .txt</button>
              <button style={s.ghostBtn} onClick={downloadHtml}>Download .html</button>
            </>
          )}
        </div>
      </div>

      <div style={s.generateRow}>
        <div style={s.generateCard}>
          <div style={s.generateTitle}>Rough draft</div>
          <div style={s.generateDesc}>Shape all your interview answers into a complete narrative. Focus on capturing everything and finding the structure. Best when you've finished a round of interviews.</div>
          <button style={s.solidBtn} onClick={() => generate('rough_draft')} disabled={generating || totalAnswers === 0}>
            {generating && phase === 'rough_draft' ? 'Generating...' : 'Generate rough draft'}
          </button>
        </div>
        <div style={s.generateCard}>
          <div style={s.generateTitle}>First draft</div>
          <div style={s.generateDesc}>Polish the prose, sharpen the humor, deepen the emotional moments. Use after you've done gap-fill interviews and are ready for others to read.</div>
          <button style={s.solidBtn} onClick={() => generate('first_draft')} disabled={generating || !manuscript}>
            {generating && phase === 'first_draft' ? 'Generating...' : 'Upgrade to first draft'}
          </button>
        </div>
      </div>

      {status && <div style={s.status}>{status}</div>}

      {manuscript && (
        <div style={s.manuscriptBox}>
          <pre style={s.manuscriptText}>{manuscript}</pre>
        </div>
      )}

      {!manuscript && loaded && totalAnswers === 0 && (
        <div style={s.empty}>Complete some interview sessions first, then come here to generate your manuscript.</div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 780 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 22, fontWeight: 500, color: '#e8e8e8', marginBottom: 4 },
  sub: { fontSize: 14, color: '#666' },
  btnRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  ghostBtn: { padding: '7px 14px', background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  solidBtn: { padding: '8px 16px', background: '#e8e8e8', border: 'none', borderRadius: 6, color: '#0f0f0f', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginTop: 12 },
  generateRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.5rem' },
  generateCard: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '1.25rem' },
  generateTitle: { fontSize: 15, fontWeight: 500, color: '#e8e8e8', marginBottom: 6 },
  generateDesc: { fontSize: 13, color: '#777', lineHeight: 1.6 },
  status: { fontSize: 14, color: '#aaa', fontStyle: 'italic', padding: '12px 0', marginBottom: 8 },
  manuscriptBox: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '1.5rem', maxHeight: 600, overflowY: 'auto' },
  manuscriptText: { fontFamily: 'Georgia, serif', fontSize: 15, lineHeight: 1.8, color: '#ccc', whiteSpace: 'pre-wrap', margin: 0 },
  empty: { fontSize: 15, color: '#666', lineHeight: 1.7, padding: '2rem', background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a' }
}
