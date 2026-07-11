import { Node } from '@tiptap/core'

export interface ActionNodeOptions {
  HTMLAttributes: Record<string, any>,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    actionNode: {
      /**
       * Add an action
       */
      setAction: (attributes: {
        id?: string,
        description?: string,
        type?: string,
        duration?: number
      }) => ReturnType,
      /**
       * Update an action
       */
      updateAction: (attributes: {
        id?: string,
        description?: string,
        type?: string,
        duration?: number
      }) => ReturnType,
    }
  }
}

export const ActionNode = Node.create<ActionNodeOptions>({
  name: 'action',
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
      type: {
        default: 'general',
        parseHTML: element => element.getAttribute('data-type') || 'general',
        renderHTML: attributes => {
          return {
            'data-type': attributes.type,
          }
        },
      },
      duration: {
        default: 0,
        parseHTML: element => parseInt(element.getAttribute('data-duration') || '0'),
        renderHTML: attributes => {
          return {
            'data-duration': attributes.duration,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="action"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        ...HTMLAttributes,
        'data-type': 'action',
        class: 'action-node',
      },
      0,
    ]
  },

  addCommands() {
    return {
      setAction:
        attributes =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          })
        },
      updateAction:
        attributes =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attributes)
        },
    }
  },
})