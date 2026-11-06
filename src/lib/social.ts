import { supabase } from './supabase'
import type { Comment, Profile, ReactionKind } from './types'

// ─── Лайки и «я тут был» ─────────────────────────────────────────────────────

export function reactionKey(placeId: string, kind: ReactionKind): string {
  return `${placeId}:${kind}`
}

/** Все реакции текущего пользователя — чтобы подсветить уже нажатые кнопки */
export async function fetchMyReactions(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('place_reactions')
    .select('place_id, kind')
    .eq('user_id', userId)
  if (error) throw error
  const rows = data as { place_id: string; kind: ReactionKind }[]
  return new Set(rows.map((r) => reactionKey(r.place_id, r.kind)))
}

export async function setReaction(placeId: string, kind: ReactionKind, on: boolean, userId: string) {
  const { error } = on
    ? await supabase.from('place_reactions').insert({ place_id: placeId, kind, user_id: userId })
    : await supabase
        .from('place_reactions')
        .delete()
        .eq('place_id', placeId)
        .eq('kind', kind)
        .eq('user_id', userId)
  if (error) throw error
}

// ─── Комментарии ─────────────────────────────────────────────────────────────

// author:profiles(...) — Supabase сам подтянет имя автора по внешнему ключу
const COMMENT_COLUMNS = 'id, place_id, user_id, body, created_at, author:profiles(display_name)'

type CommentRow = Omit<Comment, 'author_name'> & { author: { display_name: string } | null }

function toComment(row: CommentRow): Comment {
  const { author, ...rest } = row
  return { ...rest, author_name: author?.display_name ?? 'Аноним' }
}

export async function fetchComments(placeId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('place_comments')
    .select(COMMENT_COLUMNS)
    .eq('place_id', placeId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as unknown as CommentRow[]).map(toComment)
}

export async function addComment(placeId: string, body: string, userId: string): Promise<Comment> {
  const { data, error } = await supabase
    .from('place_comments')
    .insert({ place_id: placeId, body, user_id: userId })
    .select(COMMENT_COLUMNS)
    .single()
  if (error) throw error
  return toComment(data as unknown as CommentRow)
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from('place_comments').delete().eq('id', id)
  if (error) throw error
}

// ─── Профили ─────────────────────────────────────────────────────────────────

export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function updateDisplayName(id: string, displayName: string) {
  const { error } = await supabase.from('profiles').update({ display_name: displayName }).eq('id', id)
  if (error) throw error
}
