// src/__tests__/setup.ts

// Global test setup
beforeAll(() => {
    console.log('Starting blockchain integration tests');
    
    // Set longer timeout for blockchain operations
    jest.setTimeout(30000);
    
    // Suppress noisy console logs during tests if needed
    // const originalConsoleLog = console.log;
    // console.log = (...args) => {
    //   if (process.env.DEBUG) {
    //     originalConsoleLog(...args);
    //   }
    // };
  });
  
  // Global teardown
  afterAll(() => {
    console.log('Blockchain integration tests completed');
  });
  
  // Mock global fetch for tests if needed
  global.fetch = jest.fn();
  
  // Mock atob for Node.js environment
  global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
  global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');