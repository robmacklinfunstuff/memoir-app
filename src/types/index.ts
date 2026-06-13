export interface MemoirAnswer {
  id?: string
  session_id: string
  question: string
  answer: string
  topic_tags: string[]
  fact_flags: FactFlag[]
  question_index: number
  created_at?: string
}

export interface MemoirSession {
  id?: string
  started_at?: string
  last_active?: string
  total_answers: number
  session_summary?: string
}

export interface MemoirManuscript {
  id?: string
  content: string
  word_count: number
  updated_at?: string
  version: number
  phase: 'rough_draft' | 'first_draft' | 'final'
}

export interface TopicMap {
  id?: string
  topics_covered: TopicEntry[]
  gaps_identified: string[]
  generated_at?: string
}

export interface TopicEntry {
  topic: string
  summary: string
  answer_count: number
  richness: 'thin' | 'moderate' | 'rich'
}

export interface FactFlag {
  claim: string
  status: 'verified' | 'uncertain' | 'check'
  note: string
}

export interface StyleNote {
  id?: string
  note: string
  created_at?: string
}

export type AppScreen = 'interview' | 'topic_map' | 'manuscript' | 'history'
export type Phase = 'interviewing' | 'topic_review' | 'drafting' | 'gap_fill' | 'first_draft'
