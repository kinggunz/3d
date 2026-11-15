export default {
  base: './',
  define: { global: 'globalThis' },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 4000
  }
};
