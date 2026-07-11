import { Node } from '@tiptap/core'

export interface EpisodeNodeOptions {
  HTMLAttributes: Record<string, any>,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    episodeNode: {
      /**
       * Add an episode
       */
      setEpisode: (attributes: {
        id?: string,
        episodeNo?: number,
        title?: string,
        synopsis?: string,
        status?: string
      }) => ReturnType,
      /**
       * Update an episode
       */
      updateEpisode: (attributes: {
        id?: string,
        episodeNo?: number,
        title?: string,
        synopsis?: string,
        status?: string
      }) => ReturnType,
    }
  }
}

export const EpisodeNode = Node.create<EpisodeNodeOptions>({
  name: 'episode',
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
      episodeNo: {
        default: 1,
        parseHTML: element => parseInt(element.getAttribute('data-episode-no') || '1'),
        renderHTML: attributes => {
          return {
            'data-episode-no': attributes.episodeNo,
          }
        },
      },
      title: {
        default: '',
        parseHTML: element => element.getAttribute('data-title') || '',
        renderHTML: attributes => {
          if (!attributes.title) {
            return {}
          }
          return {
            'data-title': attributes.title,
          }
        },
      },
      synopsis: {
        default: '',
        parseHTML: element => element.getAttribute('data-synopsis') || '',
        renderHTML: attributes => {
          if (!attributes.synopsis) {
            return {}
          }
          return {
            'data-synopsis': attributes.synopsis,
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
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="episode"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        ...HTMLAttributes,
        'data-type': 'episode',
        class: 'episode-node',
      },
      0,
    ]
  },

  addCommands() {
    return {
      setEpisode:
        attributes =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          })
        },
      updateEpisode:
        attributes =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attributes)
        },
    }
  },
})