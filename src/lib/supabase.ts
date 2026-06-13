import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Run this SQL in your Supabase SQL editor to set up tables:
//
// create table memoir_sessions (
//   id uuid default gen_random_uuid() primary key,
//   started_at timestamptz default now(),
//   last_active timestamptz default now(),
//   total_answers int default 0,
//   session_summary text
// );
//
// create table memoir_answers (
//   id uuid default gen_random_uuid() primary key,
//   session_id uuid references memoir_sessions(id),
//   question text not null,
//   answer text not null,
//   topic_tags text[] default '{}',
//   fact_flags jsonb default '[]',
//   question_index int default 0,
//   created_at timestamptz default now()
// );
//
// create table memoir_manuscripts (
//   id uuid default gen_random_uuid() primary key,
//   content text not null,
//   word_count int default 0,
//   updated_at timestamptz default now(),
//   version int default 1,
//   phase text default 'rough_draft'
// );
//
// create table memoir_topic_maps (
//   id uuid default gen_random_uuid() primary key,
//   topics_covered jsonb default '[]',
//   gaps_identified jsonb default '[]',
//   generated_at timestamptz default now()
// );
//
// create table memoir_style_notes (
//   id uuid default gen_random_uuid() primary key,
//   note text not null,
//   created_at timestamptz default now()
// );
