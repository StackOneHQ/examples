// Suppress Ant Design compatibility warnings
export const suppressAntdWarnings = () => {
  if (typeof window !== 'undefined') {
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.warn = (...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('[antd: compatible]')) {
        return; // Suppress Ant Design compatibility warnings
      }
      originalWarn.apply(console, args);
    };
    
    console.error = (...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('[antd: compatible]')) {
        return; // Suppress Ant Design compatibility warnings
      }
      originalError.apply(console, args);
    };
  }
};
