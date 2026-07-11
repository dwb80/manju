import { Node } from '@tiptap/core'

export interface CharacterNodeOptions {
  HTMLAttributes: Record<string, any>,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    characterNode: {
      /**
       * Add a character
       */
      setCharacter: (attributes: {
        id?: string,
        name?: string,
        assetId?: string,
        description?: string,
        color?: string
      }) => ReturnType,
      /**
       * Update a character
       */
      updateCharacter: (attributes: {
        id?: string,
        name?: string,
        assetId?: string,
        description?: string,
        color?: string
      }) => ReturnType,
    }
  }
}

export const CharacterNode = Node.create<CharacterNodeOptions>({
  name: 'character',
  group: 'block',
  content: 'inline*',
  defining: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      id: {
        default: '',
        parseHTML: element => element.getAttribute('data-id') || '',
        renderHTML: attributes => {
          if (!attributes.id) {
            return {}
          }
          return {
            'data-id': attributes.id,
          }
        },
      },
      name: {
        default: '',
        parseHTML: element => element.getAttribute('data-name') || '',
        renderHTML: attributes => {
          if (!attributes.name) {
            return {}
          }
          return {
            'data-name': attributes.name,
          }
        },
      },
      assetId: {
        default: '',
        parseHTML: element => element.getAttribute('data-asset-id') || '',
        renderHTML: attributes => {
          if (!attributes.assetId) {
            return {}
          }
          return {
            'data-asset-id': attributes.assetId,
          }
        },
      },
      description: {
        default: '',
        parseHTML: element => element.getAttribute('data-description') || '',
        renderHTML: attributes => {
          if (!attributes.description) {
            return {}
          }
          return {
            'data-description': attributes.description,
          }
        },
      },
      color: {
        default: '#3b82f6',
        parseHTML: element => element.getAttribute('data-color') || '#3b82f6',
        renderHTML: attributes => {
          return {
            'data-color': attributes.color,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="character"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        ...HTMLAttributes,
        'data-type': 'character',
        class: 'character-node',
      },
      0,
    ]
  },

  addCommands() {
    return {
      setCharacter:
        attributes =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          })
        },
      updateCharacter:
        attributes =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attributes)
        },
    }
  },
})