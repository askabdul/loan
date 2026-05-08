const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  // Override res.json to capture response time
  const originalJson = res.json;
  res.json = function(data) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const endMemory = process.memoryUsage();
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

    // Log performance metrics for slow requests
    if (responseTime > 1000) { // Log requests taking more than 1 second
      console.warn(`⚠️  SLOW REQUEST: ${req.method} ${req.originalUrl}`);
      console.warn(`   Response Time: ${responseTime}ms`);
      console.warn(`   Memory Delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
      console.warn(`   Status: ${res.statusCode}`);
    }

    // Add performance headers
    res.set({
      'X-Response-Time': `${responseTime}ms`,
      'X-Memory-Usage': `${(endMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`
    });

    return originalJson.call(this, data);
  };

  next();
};

// Database query performance tracker
const trackDatabaseQuery = (model, operation) => {
  return async function(...args) {
    const startTime = Date.now();
    
    try {
      const result = await model[operation].apply(model, args);
      const queryTime = Date.now() - startTime;
      
      // Log slow database queries
      if (queryTime > 500) { // Log queries taking more than 500ms
        console.warn(`🐌 SLOW DB QUERY: ${model.modelName}.${operation}`);
        console.warn(`   Query Time: ${queryTime}ms`);
        console.warn(`   Args:`, JSON.stringify(args, null, 2));
      }
      
      return result;
    } catch (error) {
      const queryTime = Date.now() - startTime;
      console.error(`❌ DB QUERY ERROR: ${model.modelName}.${operation}`);
      console.error(`   Query Time: ${queryTime}ms`);
      console.error(`   Error:`, error.message);
      throw error;
    }
  };
};

// Memory usage monitor
const memoryMonitor = () => {
  const usage = process.memoryUsage();
  const formatMemory = (bytes) => (bytes / 1024 / 1024).toFixed(2) + 'MB';
  
  return {
    rss: formatMemory(usage.rss),
    heapTotal: formatMemory(usage.heapTotal),
    heapUsed: formatMemory(usage.heapUsed),
    external: formatMemory(usage.external)
  };
};

// Performance statistics collector
class PerformanceStats {
  constructor() {
    this.requestCounts = new Map();
    this.responseTimes = new Map();
    this.errorCounts = new Map();
    this.startTime = Date.now();
  }

  recordRequest(method, path, responseTime, statusCode) {
    const key = `${method} ${path}`;
    
    // Count requests
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);
    
    // Track response times
    if (!this.responseTimes.has(key)) {
      this.responseTimes.set(key, []);
    }
    this.responseTimes.get(key).push(responseTime);
    
    // Count errors
    if (statusCode >= 400) {
      this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    }
  }

  getStats() {
    const stats = {
      uptime: Date.now() - this.startTime,
      memory: memoryMonitor(),
      endpoints: []
    };

    for (const [endpoint, count] of this.requestCounts) {
      const times = this.responseTimes.get(endpoint) || [];
      const errors = this.errorCounts.get(endpoint) || 0;
      
      const avgResponseTime = times.length > 0 
        ? times.reduce((a, b) => a + b, 0) / times.length 
        : 0;
      
      const maxResponseTime = times.length > 0 ? Math.max(...times) : 0;
      
      stats.endpoints.push({
        endpoint,
        requests: count,
        avgResponseTime: Math.round(avgResponseTime),
        maxResponseTime,
        errors,
        errorRate: count > 0 ? ((errors / count) * 100).toFixed(2) + '%' : '0%'
      });
    }

    // Sort by request count
    stats.endpoints.sort((a, b) => b.requests - a.requests);
    
    return stats;
  }

  reset() {
    this.requestCounts.clear();
    this.responseTimes.clear();
    this.errorCounts.clear();
    this.startTime = Date.now();
  }
}

const performanceStats = new PerformanceStats();

// Enhanced performance monitor with statistics
const enhancedPerformanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  
  // Override res.end to capture final metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    
    // Record statistics
    performanceStats.recordRequest(
      req.method, 
      req.route ? req.route.path : req.path, 
      responseTime, 
      res.statusCode
    );
    
    return originalEnd.apply(this, args);
  };
  
  next();
};

module.exports = {
  performanceMonitor,
  enhancedPerformanceMonitor,
  trackDatabaseQuery,
  memoryMonitor,
  performanceStats
};