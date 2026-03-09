interface ProgressBarProps {
  value: number // 0-100
  className?: string
  color?: string
  showLabel?: boolean
}

export function ProgressBar({ value, className = '', color, showLabel = false }: ProgressBarProps) {
  const pct = Math.min(Math.max(value, 0), 100)
  const bgColor = color || (pct >= 100 ? '#EF4444' : pct >= 75 ? '#F59E0B' : '#10B981')

  return (
    <div className={`w-full ${className}`}>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: bgColor }}
        />
      </div>
      {showLabel && (
        <p className="mt-1 text-xs text-right text-gray-500">{pct}%</p>
      )}
    </div>
  )
}
