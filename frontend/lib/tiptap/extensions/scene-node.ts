import { Node } from '@tiptap/core'

export interface SceneNodeOptions {
  HTMLAttributes: Record<string, any>,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sceneNode: {
      /**
       * Add a scene
       */
      setScene: (attributes: {
        id?: string,
        location?: string,
        time?: string,
        description?: string,
        status?: string,
        assetId?: string
      }) => ReturnType,
      /**
       * Update a scene
       */
      updateScene: (attributes: {
        id?: string,
        location?: string,
        time?: string,
        description?: string,
        status?: string,
        assetId?: string
      }) => ReturnType,
    }
  }
}

export const SceneNode = Node.create<SceneNodeOptions>({
  name: 'scene',
  group: 'block',
  content: 'block+',
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
      location: {
        default: '',
        parseHTML: element => element.getAttribute('data-location') || '',
        renderHTML: attributes => {
          if (!attributes.location) {
            return {}
          }
          return {
            'data-location': attributes.location,
          }
        },
      },
      time: {
        default: '',
        parseHTML: element => element.getAttribute('data-time') || '',
        renderHTML: attributes => {
          if (!attributes.time) {
            return {}
          }
          return {
            'data-time': attributes.time,
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
      status: {
        default: 'draft',
        parseHTML: element => element.getAttribute('data-status') || 'draft',
        renderHTML: attributes => {
          return {
            'data-status': attributes.status,
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
        tag: 'div[data-type="scene"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        ...HTMLAttributes,
        'data-type': 'scene',
        class: 'scene-node',
      },
      0,
    ]
  },

  addCommands() {
    return {
      setScene:
        attributes =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          })
        },
      updateScene:
        attributes =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attributes)
        },
    }
  },
})