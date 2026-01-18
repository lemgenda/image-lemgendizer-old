export default class MockWorker {
    constructor() {
        this.onmessage = null;
        this.onerror = null;
    }
    postMessage(data) {
        setTimeout(() => {
            if (this.onmessage) {
                this.onmessage({ data: { id: data.id, type: 'SUCCESS', payload: { success: true, predictions: [], resultBitmap: {} } } });
            }
        }, 10);
    }
    terminate() { }
    addEventListener() { }
    removeEventListener() { }
    dispatchEvent() { return true; }
}
