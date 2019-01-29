import { promisify } from 'util'
import * as fs from 'fs'
import * as postcss from 'postcss'

import { plugins } from '../postcss.config'

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const postCssProcessor = postcss(plugins)

export interface CssModulesObj {
  [key: string]: string
}

export async function buildCssModules(file: string): Promise<CssModulesObj | null> {
  const content = await readFile(file)
  const result = await postCssProcessor.process(content)
  await writeFile(file, result.css)

  const modules = result.messages.find(x => x.plugin === 'postcss-modules')

  return modules ? modules.exportTokens : null
}
