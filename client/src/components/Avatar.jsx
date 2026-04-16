export default function Avatar({ name = '', color = '#5b8def', size }) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
  const cls = 'avatar' + (size ? ' ' + size : '')
  return (
    <span className={cls} style={{ background: color }} aria-label={name}>
      {initials || '?'}
    </span>
  )
}
