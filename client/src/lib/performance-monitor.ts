// Performance monitoring for translation system

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private requestCounts = new Map<string, number>();
  private requestTimes = new Map<string, number[]>();
  private errors = new Map<string, number>();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Track API request
  trackRequest(endpoint: string, success: boolean = true): void {
    const key = endpoint;
    
    // Count requests
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);
    
    // Track timing
    if (!this.requestTimes.has(key)) {
      this.requestTimes.set(key, []);
    }
    this.requestTimes.get(key)!.push(Date.now());
    
    // Track errors
    if (!success) {
      this.errors.set(key, (this.errors.get(key) || 0) + 1);
    }
  }

  // Check for duplicate requests
  detectDuplicateRequests(endpoint: string, timeWindow: number = 5000): boolean {
    const times = this.requestTimes.get(endpoint) || [];
    const now = Date.now();
    
    // Count requests in the last timeWindow ms
    const recentRequests = times.filter(time => now - time < timeWindow);
    
    return recentRequests.length > 3; // More than 3 requests in 5 seconds
  }

  // Get performance report
  getReport(): {
    totalRequests: number;
    endpoints: Array<{
      endpoint: string;
      count: number;
      errors: number;
      isDuplicate: boolean;
    }>;
  } {
    const endpoints: Array<{
      endpoint: string;
      count: number;
      errors: number;
      isDuplicate: boolean;
    }> = [];

    let totalRequests = 0;

    for (const [endpoint, count] of Array.from(this.requestCounts.entries())) {
      totalRequests += count;
      endpoints.push({
        endpoint,
        count,
        errors: this.errors.get(endpoint) || 0,
        isDuplicate: this.detectDuplicateRequests(endpoint)
      });
    }

    return {
      totalRequests,
      endpoints: endpoints.sort((a, b) => b.count - a.count)
    };
  }

  // Clear old data
  cleanup(): void {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const [endpoint, times] of Array.from(this.requestTimes.entries())) {
      const recentTimes = times.filter((time: number) => now - time < oneHour);
      this.requestTimes.set(endpoint, recentTimes);
    }
  }

  // Log report to console
  logReport(): void {
    const report = this.getReport();
    console.log('=== Performance Report ===');
    console.log(`Total API requests: ${report.totalRequests}`);
    
    report.endpoints.forEach(endpoint => {
      console.log(`${endpoint.endpoint}: ${endpoint.count} requests, ${endpoint.errors} errors${endpoint.isDuplicate ? ' (DUPLICATE DETECTED)' : ''}`);
    });
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();