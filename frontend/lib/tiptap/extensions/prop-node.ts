import { Node } from '@tiptap/core'

export interface PropNodeOptions {
  HTMLAttributes: Record<string, any>,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    propNode: {
      /**
       * Add a prop
       */
      setProp: (attributes: {
        id?: string,
        name?: string,
        assetId?: string,
        description?: string,
        position?: string
      }) => ReturnType,
      /**
       * Update a prop
       */
      updateProp: (attributes: {
        id?: string,
        name?: string,
        assetId?: string,
        description?: string,
        position?: string
      }) => ReturnType,
    }
  }
}

export const PropNode = Node.create<PropNodeOptions>({
  name: 'prop',
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
      position: {
        default: '',
        parseHTML: element => element.getAttribute('data-position') || '',
        renderHTML: attributes => {
          if (!attributes.position) {
            return {}
          }
          return {
            'data-position': attributes.position,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="prop"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        ...HTMLAttributes,
        'data-type': 'prop',
        class: 'prop-node',
      },
      0,
    ]
  },

  addCommands() {
    return {
      setProp:
        attributes =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          })
        },
      updateProp:
        attributes =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attributes)
        },
    }
  },
})