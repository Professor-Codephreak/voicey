type EventHandler = (data?: any) => void;

class EventService {
    private listeners: { [key: string]: EventHandler[] } = {};

    on(eventName: string, handler: EventHandler): void {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(handler);
    }

    off(eventName: string, handler: EventHandler): void {
        if (!this.listeners[eventName]) {
            return;
        }
        this.listeners[eventName] = this.listeners[eventName].filter(
            (l) => l !== handler
        );
    }

    emit(eventName: string, data?: any): void {
        if (!this.listeners[eventName]) {
            return;
        }
        this.listeners[eventName].forEach((handler) => handler(data));
    }
}

// Export a singleton instance to be used throughout the application
const eventService = new EventService();
export default eventService;
