// Query key factory for consistent cache management
// This ensures proper cache invalidation and prevents key conflicts

export const queryKeys = {
  // Drafts
  drafts: {
    all: ['drafts'] as const,
    lists: () => [...queryKeys.drafts.all, 'list'] as const,
    list: () => [...queryKeys.drafts.lists()] as const,
    details: () => [...queryKeys.drafts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.drafts.details(), id] as const,
  },

  // Releases
  releases: {
    all: ['releases'] as const,
    lists: () => [...queryKeys.releases.all, 'list'] as const,
    list: () => [...queryKeys.releases.lists()] as const,
    details: () => [...queryKeys.releases.all, 'detail'] as const,
    detail: (version: string) => [...queryKeys.releases.details(), version] as const,
  },

  // File browser
  files: {
    all: ['files'] as const,
    browse: (draftId: string, path: string) =>
      [...queryKeys.files.all, 'browse', draftId, path] as const,
    read: (draftId: string, path: string) =>
      [...queryKeys.files.all, 'read', draftId, path] as const,
  },

  // Blacklist
  blacklist: {
    all: ['blacklist'] as const,
    list: () => [...queryKeys.blacklist.all, 'list'] as const,
  },

  // Version suggestions
  suggestions: {
    all: ['suggestions'] as const,
    analyze: (draftId: string) => [...queryKeys.suggestions.all, draftId] as const,
  },

  // Changelog
  changelog: {
    all: ['changelog'] as const,
    generate: (draftId: string) => [...queryKeys.changelog.all, draftId] as const,
  },
} as const;
