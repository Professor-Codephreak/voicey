// Performance monitoring and error tracking service

interface PerformanceMetric {
    name: string;
    duration: number;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

interface ErrorEvent {
    message: string;
    stack?: string;
    timestamp: number;
    context?: Record<string, unknown>;
}

class MonitoringService {
    private metrics: PerformanceMetric[] = [];
    private errors: ErrorEvent[] = [];
    private maxStoredMetrics = 100;
    private maxStoredErrors = 50;

    // Track performance of async operations
    async trackPerformance<T>(
        name: string,
        operation: () => Promise<T>,
        metadata?: Record<string, unknown>
    ): Promise<T> {
        const startTime = performance.now();
        try {
            const result = await operation();
            const duration = performance.now() - startTime;
            this.recordMetric({ name, duration, timestamp: Date.now(), metadata });
            return result;
        } catch (error) {
            const duration = performance.now() - startTime;
            this.recordMetric({ name: `${name}_error`, duration, timestamp: Date.now(), metadata });
            throw error;
        }
    }

    // Track synchronous operations
    trackSync<T>(
        name: string,
        operation: () => T,
        metadata?: Record<string, unknown>
    ): T {
        const startTime = performance.now();
        try {
            const result = operation();
            const duration = performance.now() - startTime;
            this.recordMetric({ name, duration, timestamp: Date.now(), metadata });
            return result;
        } catch (error) {
            const duration = performance.now() - startTime;
            this.recordMetric({ name: `${name}_error`, duration, timestamp: Date.now(), metadata });
            throw error;
        }
    }

    // Record custom metric
    recordMetric(metric: PerformanceMetric): void {
        this.metrics.push(metric);
        if (this.metrics.length > this.maxStoredMetrics) {
            this.metrics.shift();
        }

        // Log slow operations (>1s)
        if (metric.duration > 1000) {
            console.warn(`[Performance] Slow operation detected: ${metric.name} took ${metric.duration.toFixed(2)}ms`, metric.metadata);
        }
    }

    // Track errors
    trackError(error: Error | string, context?: Record<string, unknown>): void {
        const errorEvent: ErrorEvent = {
            message: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: Date.now(),
            context,
        };

        this.errors.push(errorEvent);
        if (this.errors.length > this.maxStoredErrors) {
            this.errors.shift();
        }

        console.error('[Error Tracked]', errorEvent);
    }

    // Get performance statistics
    getStats(metricName?: string): {
        count: number;
        avg: number;
        min: number;
        max: number;
        p95: number;
    } | null {
        const filtered = metricName
            ? this.metrics.filter(m => m.name === metricName)
            : this.metrics;

        if (filtered.length === 0) return null;

        const durations = filtered.map(m => m.duration).sort((a, b) => a - b);
        const sum = durations.reduce((acc, d) => acc + d, 0);
        const p95Index = Math.floor(durations.length * 0.95);

        return {
            count: filtered.length,
            avg: sum / filtered.length,
            min: durations[0],
            max: durations[durations.length - 1],
            p95: durations[p95Index] || durations[durations.length - 1],
        };
    }

    // Get recent metrics
    getRecentMetrics(limit = 10): PerformanceMetric[] {
        return this.metrics.slice(-limit);
    }

    // Get recent errors
    getRecentErrors(limit = 10): ErrorEvent[] {
        return this.errors.slice(-limit);
    }

    // Clear all data
    clear(): void {
        this.metrics = [];
        this.errors = [];
    }

    // Export for debugging
    exportData(): { metrics: PerformanceMetric[]; errors: ErrorEvent[] } {
        return {
            metrics: [...this.metrics],
            errors: [...this.errors],
        };
    }

    // Print summary to console
    printSummary(): void {
        console.group('[Monitoring Summary]');

        // Group metrics by name
        const metricsByName = this.metrics.reduce((acc, m) => {
            if (!acc[m.name]) acc[m.name] = [];
            acc[m.name].push(m);
            return acc;
        }, {} as Record<string, PerformanceMetric[]>);

        console.log('Performance Metrics:');
        Object.entries(metricsByName).forEach(([name, _metrics]) => {
            const stats = this.getStats(name);
            console.log(`  ${name}:`, stats);
        });

        console.log(`\nTotal Errors: ${this.errors.length}`);
        if (this.errors.length > 0) {
            console.log('Recent Errors:', this.errors.slice(-5));
        }

        console.groupEnd();
    }
}

// Singleton instance
const monitoringService = new MonitoringService();

// Expose globally for debugging
if (typeof window !== 'undefined') {
    (window as unknown as { __monitoring: MonitoringService }).__monitoring = monitoringService;
}

export default monitoringService;
