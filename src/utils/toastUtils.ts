export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastEventDetail {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

export const TOAST_EVENT_NAME = 'antigravity-toast-event';

/**
 * Dispatches a custom event to trigger a toast notification.
 * Useful for non-React files like workers or processors.
 */
export const showToast = (message: string, type: ToastType = 'info', duration = 3000) => {
    const detail: ToastEventDetail = {
        id: Date.now().toString() + Math.random().toString().slice(2, 5),
        message,
        type,
        duration
    };
    window.dispatchEvent(new CustomEvent(TOAST_EVENT_NAME, { detail }));
};
