import { Node } from '@tiptap/core'

export interface CameraNodeOptions {
  HTMLAttributes: Record<string, any>,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    cameraNode: {
      /**
       * Add a camera shot
       */
      setCamera: (attributes: {
        id?: string,
        shotSize?: string,
        cameraMove?: string,
        angle?: string,
        duration?: number,
        description?: string
      }) => ReturnType,
      /**
       * Update a camera shot
       */
      updateCamera: (attributes: {
        id?: string,
        shotSize?: string,
        cameraMove?: string,
        angle?: string,
        duration?: number,
        description?: string
      }) => ReturnType,
    }
  }
}

export const CameraNode = Node.create<CameraNodeOptions>({
  name: 'camera',
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
      shotSize: {
        default: 'medium',
        parseHTML: element => element.getAttribute('data-shot-size') || 'medium',
        renderHTML: attributes => {
          return {
            'data-shot-size': attributes.shotSize,
          }
        },
      },
      cameraMove: {
        default: 'static',
        parseHTML: element => element.getAttribute('data-camera-move') || 'static',
        renderHTML: attributes => {
          return {
            'data-camera-move': attributes.cameraMove,
          }
        },
      },
      angle: {
        default: 'eye-level',
        parseHTML: element => element.getAttribute('data-angle') || 'eye-level',
        renderHTML: attributes => {
          return {
            'data-angle': attributes.angle,
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
        tag: 'div[data-type="camera"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        ...HTMLAttributes,
        'data-type': 'camera',
        class: 'camera-node',
      },
      0,
    ]
  },

  addCommands() {
    return {
      setCamera:
        attributes =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          })
        },
      updateCamera:
        attributes =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attributes)
        },
    }
  },
})