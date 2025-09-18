// Suppress Ant Design React version compatibility warnings
// This file should be loaded as early as possible to catch warnings

// Run immediately when this file is loaded
(function() {
  if (typeof window !== 'undefined' && typeof console !== 'undefined') {
    const originalWarn = console.warn;
    console.warn = (...args) => {
      const warningMessage = args[0];
      if (typeof warningMessage === 'string' && 
          (warningMessage.includes('[antd: compatible]') || 
           warningMessage.includes('antd v5 support React') ||
           warningMessage.includes('React is 16 ~ 18') ||
           warningMessage.includes('antd v5 support React is 16 ~ 18') ||
           warningMessage.includes('see https://u.ant.design/v5-for-19') ||
           warningMessage.includes('antd v5 support React is 16 ~ 18. see https://u.ant.design/v5-for-19'))) {
        // Suppress the warning silently
        return;
      }
      originalWarn.apply(console, args);
    };
  }
})();

// Also run when DOM is ready as a backup
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      if (typeof console !== 'undefined') {
        const originalWarn = console.warn;
        console.warn = (...args) => {
          const warningMessage = args[0];
          if (typeof warningMessage === 'string' && 
              (warningMessage.includes('[antd: compatible]') || 
               warningMessage.includes('antd v5 support React') ||
               warningMessage.includes('React is 16 ~ 18') ||
               warningMessage.includes('antd v5 support React is 16 ~ 18') ||
               warningMessage.includes('see https://u.ant.design/v5-for-19') ||
               warningMessage.includes('antd v5 support React is 16 ~ 18. see https://u.ant.design/v5-for-19'))) {
            return;
          }
          originalWarn.apply(console, args);
        };
      }
    });
  }
}
