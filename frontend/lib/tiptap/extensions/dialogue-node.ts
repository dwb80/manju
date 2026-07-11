import { Node } from '@tiptap/core'

export interface DialogueNodeOptions {
  HTMLAttributes: Record<string, any>,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dialogueNode: {
      /**
       * Add a dialogue
       */
      setDialogue: (attributes: {
        id?: string,
        characterId?: string,
        characterName?: string,
        emotion?: string,
        content?: string
      }) => ReturnType,
      /**
       * Update a dialogue
       */
      updateDialogue: (attributes: {
        id?: string,
        characterId?: string,
        characterName?: string,
        emotion?: string,
        content?: string
      }) => ReturnType,
    }
  }
}

export const DialogueNode = Node.create<DialogueNodeOptions>({
  name: 'dialogue',
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
      characterId: {
        default: '',
        parseHTML: element => element.getAttribute('data-character-id') || '',
        renderHTML: attributes => {
          if (!attributes.characterId) {
            return {}
          }
          return {
            'data-character-id': attributes.characterId,
          }
        },
      },
      characterName: {
        default: '',
        parseHTML: element => element.getAttribute('data-character-name') || '',
        renderHTML: attributes => {
          if (!attributes.characterName) {
            return {}
          }
          return {
            'data-character-name': attributes.characterName,
          }
        },
      },
      emotion: {
        default: 'neutral',
        parseHTML: element => element.getAttribute('data-emotion') || 'neutral',
        renderHTML: attributes => {
          return {
            'data-emotion': attributes.emotion,
          }
        },
      },
      content: {
        default: '',
        parseHTML: element => element.getAttribute('data-content') || '',
        renderHTML: attributes => {
          if (!attributes.content) {
            return {}
          }
          return {
            'data-content': attributes.content,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="dialogue"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        ...HTMLAttributes,
        'data-type': 'dialogue',
        class: 'dialogue-node',
      },
      0,
    ]
  },

  addCommands() {
    return {
      setDialogue:
        attributes =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          })
        },
      updateDialogue:
        attributes =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attributes)
        },
    }
  },
})