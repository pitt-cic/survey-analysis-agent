import type { AnalysisResponse } from '../api/query'

/**
 * Convert AnalysisResponse to markdown string for copy/download
 */
export function analysisToMarkdown(response: AnalysisResponse): string {
  const lines: string[] = []

  lines.push(`# Summary\n`)
  lines.push(response.summary)
  lines.push('')

  for (const theme of response.themes) {
    lines.push(`## ${theme.name}`)
    lines.push('')
    lines.push(theme.summary)
    lines.push('')

    if (theme.supporting_citations.length > 0) {
      lines.push('**Supporting citations:**')
      lines.push('')
      for (const citation of theme.supporting_citations) {
        lines.push(`> "${citation.excerpt}"`)
        lines.push('')
      }
    }
  }

  return lines.join('\n')
}
