import { Node } from '@tiptap/core'

export interface EmotionNodeOptions {
  HTMLAttributes: Record<string, any>,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    emotionNode: {
      /**
       * Add an emotion
       */
      setEmotion: (attributes: {
        id?: string,
        type?: string,
        intensity?: string,
        description?: string
      }) => ReturnType,
      /**
       * Update an emotion
       */
      updateEmotion: (attributes: {
        id?: string,
        type?: string,
        intensity?: string,
        description?: string
      }) => ReturnType,
    }
  }
}

export const EmotionNode = Node.create<EmotionNodeOptions>({
  name: 'emotion',
  group: 'inline',
  inline: true,
  atom: true,

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
        default: 'neutral',
        parseHTML: element => element.getAttribute('data-type') || 'neutral',
        renderHTML: attributes => {
          return {
            'data-type': attributes.type,
          }
        },
      },
      intensity: {
        default: 'medium',
        parseHTML: element => element.getAttribute('data-intensity') || 'medium',
        renderHTML: attributes => {
          return {
            'data-intensity': attributes.intensity,
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
        tag: 'span[data-type="emotion"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-type': 'emotion',
        class: 'emotion-node',
      },
    ]
  },

  addCommands() {
    return {
      setEmotion:
        attributes =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          })
        },
      updateEmotion:
        attributes =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attributes)
        },
    }
  },
})