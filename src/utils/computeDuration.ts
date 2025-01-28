export function computeDuration({
  start,
  end
}: {
  start: Date
  end: Date
}): string {
  const duration = end.valueOf() - start.valueOf()
  let delta = duration / 1000

  const days = Math.floor(delta / 86400)
  delta -= days * 86400
  const hours = Math.floor(delta / 3600) % 24
  delta -= hours * 3600
  const minutes = Math.floor(delta / 60) % 60
  delta -= minutes * 60
  const seconds = Math.floor(delta % 60)

  const format = (value: number, unit: string): string =>
    value > 0 ? `${value}${unit} ` : ''
  return `${format(days, 'd')}${format(hours, 'h')}${format(
    minutes,
    'm'
  )}${format(seconds, 's')}`.trim()
}
