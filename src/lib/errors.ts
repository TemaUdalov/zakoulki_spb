// Ошибки Supabase — это не всегда экземпляры Error, поэтому достаём сообщение аккуратно
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') {
    return e.message
  }
  return 'Что-то пошло не так'
}
