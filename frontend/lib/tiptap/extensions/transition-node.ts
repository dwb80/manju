import { Node } from '@tiptap/core'

export interface TransitionNodeOptions {
  HTMLAttributes: Record<string, any>,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    transitionNode: {
      /**
       * Add a transition
       */
      setTransition: (attributes: {
        id?: string,
        type?: string,
        duration?: number,
        description?: string
      }) => ReturnType,
      /**
       * Update a transition
       */
      updateTransition: (attributes: {
        id?: string,
        type?: string,
        duration?: number,
        description?: string
      }) => ReturnType,
    }
  }
}

export const TransitionNode = Node.create<TransitionNodeOptions>({
  name: 'transition',
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
      type: {
        default: 'cut',
        parseHTML: element => element.getAttribute('data-type') || 'cut',
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
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="transition"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        ...HTMLAttributes,
        'data-type': 'transition',
        class: 'transition-node',
      },
      0,
    ]
  },

  addCommands() {
    return {
      setTransition:
        attributes =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          })
        },
      updateTransition:
        attributes =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attributes)
        },
    }
  },
})