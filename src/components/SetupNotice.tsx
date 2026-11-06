// Показывается, пока в .env не прописаны ключи Supabase
export function SetupNotice() {
  return (
    <div className="stack">
      <h2>Почти готово</h2>
      <p>Карта работает, но для мест нужна база данных. Чтобы её подключить:</p>
      <ol className="setup-steps">
        <li>
          Создай проект на <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>.
        </li>
        <li>
          В <b>SQL Editor</b> выполни файл <code>supabase/schema.sql</code>.
        </li>
        <li>
          Скопируй <code>.env.example</code> в <code>.env</code> и вставь туда Project URL и ключ из
          раздела <b>Project Settings → API</b>.
        </li>
        <li>
          Перезапусти <code>npm run dev</code>.
        </li>
      </ol>
    </div>
  )
}
