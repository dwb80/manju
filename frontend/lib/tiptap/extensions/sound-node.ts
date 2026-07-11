import { Node } from '@tiptap/core'

export interface SoundNodeOptions {
  HTMLAttributes: Record<string, any>,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    soundNode: {
      /**
       * Add a sound
       */
      setSound: (attributes: {
        id?: string,
        type?: string,
        volume?: string,
        duration?: number,
        description?: string,
        assetId?: string
      }) => ReturnType,
      /**
       * Update a sound
       */
      updateSound: (attributes: {
        id?: string,
        type?: string,
        volume?: string,
        duration?: number,
        description?: string,
        assetId?: string
      }) => ReturnType,
    }
  }
}

export const SoundNode = Node.create<SoundNodeOptions>({
  name: 'sound',
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
        default: 'sfx',
        parseHTML: element => element.getAttribute('data-type') || 'sfx',
        renderHTML: attributes => {
          return {
            'data-type': attributes.type,
          }
        },
      },
      volume: {
        default: 'medium',
        parseHTML: element => element.getAttribute('data-volume') || 'medium',
        renderHTML: attributes => {
          return {
            'data-volume': attributes.volume,
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
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="sound"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        ...HTMLAttributes,
        'data-type': 'sound',
        class: 'sound-node',
      },
      0,
    ]
  },

  addCommands() {
    return {
      setSound:
        attributes =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          })
        },
      updateSound:
        attributes =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attributes)
        },
    }
  },
})