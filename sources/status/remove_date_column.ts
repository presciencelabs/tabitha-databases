import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const dir = import.meta.dir
const files = await readdir(dir)

for (const file of files) {
  if (file.endsWith('.raw.csv')) {
    const filePath = join(dir, file)
    const content = await readFile(filePath, 'utf-8')
    const lines = content.split(/\r?\n/)

    const newLines = lines.map(line => {
      // Remove header column
      if (line.startsWith('ProjectStatusDate,')) {
        return line.substring('ProjectStatusDate,'.length)
      }

      // Remove quoted date column
      if (line.startsWith('"')) {
        return line.replace(/^"[^"]*",/, '')
      }

      // Fallback if unquoted, but only if line is not empty
      if (line.length > 0) {
        return line.replace(/^[^,]*,/, '')
      }

      return line
    })

    const newFilePath = join(dir, file.replace('.raw.csv', '.csv'))
    await writeFile(newFilePath, newLines.join('\n'))
    console.log(`Processed ${file} -> ${file.replace('.raw.csv', '.csv')}`)
  }
}
