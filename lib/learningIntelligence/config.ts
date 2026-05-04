export const learningIntelligenceConfig = {
  enabled: true,
  provider: 'centralized' as 'legacy' | 'centralized',
  cacheTtlMs: {
    questions: 30 * 60 * 1000,
    summary: 20 * 60 * 1000,
    search: 10 * 60 * 1000,
    chat: 5 * 60 * 1000,
  },
  retrieval: {
    maxChunks: 5,
    maxChunkLength: 1500,
  },
};

