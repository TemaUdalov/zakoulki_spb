import { useEffect, useState } from 'react'

/**
 * Простой роутер на хэше адреса: #/place/<id>, #/user/<id>, #/nearby, #/walk.
 * Хэш выбран специально: GitHub Pages не умеет отдавать index.html на любой путь,
 * а ссылки вида site/#/place/123 работают без настройки сервера.
 */
export type Route =
  | { name: 'home' }
  | { name: 'place'; id: string }
  | { name: 'user'; id: string }
  | { name: 'nearby' }
  | { name: 'walk' }

export function parseHash(hash: string): Route {
  const [section, id] = hash.replace(/^#\/?/, '').split('/')
  if (section === 'place' && id) return { name: 'place', id }
  if (section === 'user' && id) return { name: 'user', id }
  if (section === 'nearby') return { name: 'nearby' }
  if (section === 'walk') return { name: 'walk' }
  return { name: 'home' }
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

export function navigate(path: string) {
  window.location.hash = path
}

/** Полная ссылка на место — для кнопки «Поделиться» */
export function placeLink(id: string): string {
  return `${window.location.origin}${window.location.pathname}#/place/${id}`
}
