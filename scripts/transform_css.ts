import ts from 'typescript'
import { resolve, dirname } from 'path'
import { readFileSync } from 'fs'
import { buildCssModules } from './build_css'
const CSS_EXTENSION_REGEX = /\.sss['"]?$/

export default <T extends ts.Node>(context: ts.TransformationContext) => (rootNode: T) => {
  function visit(node: ts.Node): ts.Node {
    const filepath = getImportOrRequireFilepath(node)

    if (CSS_EXTENSION_REGEX.test(filepath)) {
      const cssPath = resolveCssPath(filepath, node.getSourceFile())
      const classNameObj = generateClassNameObj(cssPath)
      // It can be "require('./style.css')" or import * as style from './style.css'
      const newNode = ts.isImportDeclaration(node)
        ? getAsImportDeclaration(classNameObj, node)
        : classNameObj

      if (newNode) {
        addSourceMaps(cssPath, newNode, node, filepath, context)
        return newNode
      }
    }

    return ts.visitEachChild(node, visit, context)
  }
  return ts.visitNode(rootNode, visit)
}

function generateClassNameObj(resolvedCssPath: string): ts.ObjectLiteralExpression {
  try {
    // this require will be implicitly caught by css-modules-require-hook and transform it to CSS classNames mappings
    const css = buildCssModules(resolvedCssPath)
    return ts.createObjectLiteral(
      ts.createNodeArray(
        Object.keys(css).map(k =>
          ts.createPropertyAssignment(ts.createLiteral(k), ts.createLiteral(css[k]))
        )
      )
    )
  } catch (e) {
    console.error(e)
    return
  }
}

function addSourceMaps(
  cssPath: string,
  newNode: ts.Node,
  node: ts.Node,
  importContent,
  context: ts.TransformationContext
) {
  const externalCssSource = ts.createSourceMapSource(cssPath, readFileSync(cssPath, 'utf-8'))
  ts.setSourceMapRange(newNode, {
    source: externalCssSource,
    pos: node.pos,
    end: node.end
  })

  const anonImport = ts.createImportDeclaration(
    undefined,
    undefined,
    undefined,
    ts.createStringLiteral(importContent.replace('.sss', '.css'))
  )

  context.hoistFunctionDeclaration(anonImport as any)
}

// replace './some/style.css' to ./some/style.css
function trimQuotes(path) {
  return path.substring(1, path.length - 1)
}

const getImportOrRequireFilepath = (node: ts.Node): string | null => {
  if (ts.isImportDeclaration(node)) return trimQuotes(node.moduleSpecifier.getText())
  else if (ts.isCallExpression(node) && node.expression.getText() === 'require')
    return trimQuotes(node.arguments[0].getText())
  else return null
}

function getAsImportDeclaration(
  classNameMappings: ts.ObjectLiteralExpression,
  node: ts.ImportDeclaration
): ts.Node {
  // No import clause, skip
  if (!node.importClause) {
    return
  }

  // This is the "foo" from "import * as foo from 'foo.css'"
  const { namedBindings } = node.importClause
  // Dealing with "import * as css from 'foo.css'" only since namedImports variables get mangled
  if (!ts.isNamespaceImport(namedBindings)) {
    return
  }

  const importVar = namedBindings.name.getText()

  // Create 'var css = {}'
  return ts.createVariableStatement(
    undefined,
    ts.createVariableDeclarationList([
      ts.createVariableDeclaration(importVar, undefined, classNameMappings)
    ])
  )
}

const resolveCssPath = (cssPath: string, sf: ts.SourceFile): string => {
  if (cssPath.startsWith('.')) {
    const sourcePath = sf.fileName
    return resolve(dirname(sourcePath), cssPath)
  }
  return cssPath
}
