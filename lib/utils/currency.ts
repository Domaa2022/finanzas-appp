export function formatHNL(amount: number): string {
  return `L ${amount.toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function parseHNL(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]/g, '')) || 0
}
