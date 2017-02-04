import fs from 'fs'
import fsPath from 'path'

const MESSAGES  = Symbol('I18nMessages')

function addMessage(path, messages, attrs) {
  const { id } = attrs
  delete attrs.id

  if (messages.has(id)) {
    const message = messages.get(id)
    if (message.defaults !== attrs.defaults) {
      throw path.buildCodeFrameError("Different defaults for the same message ID.")
    } else {
      [].push.apply(message.origin, attrs.origin)
    }
  } else {
    messages.set(id, attrs)
  }
}

export default function({ types: t }) {
  function isTransComponent(node) {
    return t.isJSXElement(node) && t.isJSXIdentifier(node.openingElement.name, { name: 'Trans' })
  }

  return {
    visitor: {
      JSXElement(path, { file }) {
        const { node } = path

        if (!isTransComponent(node)) return

        const messages = file.get(MESSAGES)

        const attrs = node.openingElement.attributes.reduce((acc, item) => {
          acc[item.name.name] = item.value.value
          return acc
        }, {})

        const filename = fsPath.relative(__dirname, file.opts.filename)
        const line = node.openingElement.loc.start.line
        attrs.origin = [[filename, line]]

        addMessage(path, messages, attrs)
      }
    },

    pre(file) {
      // Ignore else path for now. Collision is possible if other plugin is
      // using the same Symbol('I18nMessages').
      // istanbul ignore else
      if (!file.has(MESSAGES)) {
        file.set(MESSAGES, new Map())
      }
    },

    post(file) {
      const baseDir = this.opts.localeDir
      const buildDir = fsPath.join(baseDir, '_build')
      const { basename } = file.opts
      const messages = {}

      file.get(MESSAGES).forEach((value, key) => {
        messages[key] = value
      })

      if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir)
      if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir)

      fs.writeFileSync(
        fsPath.join(buildDir, `${basename}.json`),
        JSON.stringify(messages, null, 2)
      )
    }
  }
}
