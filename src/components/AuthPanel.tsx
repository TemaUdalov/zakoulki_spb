import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'

type Props = {
  onClose: () => void
}

// Вход без пароля: на почту приходит ссылка, по клику пользователь возвращается уже вошедшим
export function AuthPanel({ onClose }: Props) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    })

    if (error) {
      setError(errorMessage(error))
      setStatus('idle')
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="stack">
      <button className="btn btn--ghost back" onClick={onClose}>
        ← Назад
      </button>
      <h2>Вход</h2>

      {status === 'sent' ? (
        <p>
          Отправили ссылку на <b>{email}</b>. Открой письмо и перейди по ссылке — вернёшься сюда уже
          вошедшим.
        </p>
      ) : (
        <form className="stack" onSubmit={handleSubmit}>
          <p className="muted">Чтобы добавлять места, нужно войти. Пароль не нужен — пришлём ссылку на почту.</p>
          <label className="field">
            <span>Почта</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn--primary" disabled={status === 'sending'}>
            {status === 'sending' ? 'Отправляем…' : 'Получить ссылку'}
          </button>
        </form>
      )}
    </div>
  )
}
