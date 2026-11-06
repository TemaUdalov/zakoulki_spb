import { useEffect, useState, type FormEvent } from 'react'
import { addComment, deleteComment, fetchComments } from '../lib/social'
import { errorMessage } from '../lib/errors'
import type { Comment } from '../lib/types'

type Props = {
  placeId: string
  userId: string | null
  onNeedAuth: () => void
  /** Сообщаем наверх, чтобы обновить счётчик комментариев */
  onChanged: () => void
}

export function Comments({ placeId, userId, onNeedAuth, onChanged }: Props) {
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchComments(placeId)
      .then((c) => !cancelled && setComments(c))
      .catch((e: unknown) => !cancelled && setError(errorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [placeId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!userId) return onNeedAuth()
    const text = body.trim()
    if (text.length < 2) return

    setSending(true)
    setError(null)
    try {
      const comment = await addComment(placeId, text, userId)
      setComments((prev) => [...(prev ?? []), comment])
      setBody('')
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(comment: Comment) {
    if (!confirm('Удалить комментарий?')) return
    try {
      await deleteComment(comment.id)
      setComments((prev) => (prev ?? []).filter((c) => c.id !== comment.id))
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <section className="stack comments">
      <h3>Подсказки и комментарии</h3>

      {comments === null && !error && <p className="muted small">Загружаем…</p>}
      {comments?.length === 0 && (
        <p className="muted small">
          Пока пусто. Расскажи, как попасть внутрь, когда лучше приходить или что изменилось.
        </p>
      )}

      {comments && comments.length > 0 && (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment">
              <div className="comment__head">
                <a href={`#/user/${c.user_id}`}>{c.author_name}</a>
                <span className="muted small">
                  {new Date(c.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </span>
                {c.user_id === userId && (
                  <button className="link-btn" onClick={() => handleDelete(c)}>
                    удалить
                  </button>
                )}
              </div>
              <p className="comment__body">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form className="stack" onSubmit={handleSubmit}>
        <textarea
          className="input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => !userId && onNeedAuth()}
          maxLength={500}
          rows={2}
          placeholder={userId ? 'Например: «арка теперь на домофоне, но днём открыто»' : 'Войди, чтобы оставить комментарий'}
        />
        {body.trim().length >= 2 && (
          <button type="submit" className="btn btn--ghost" disabled={sending}>
            {sending ? 'Отправляем…' : 'Отправить'}
          </button>
        )}
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  )
}
