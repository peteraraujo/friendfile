class ContactService {
    constructor(baseUrl = '', onError) {
        this.baseUrl = baseUrl;
        this.onError = onError;
        this.currentRequest = null; // { key: string, promise: Promise, controller: AbortController }
    }

    // Utility: Generate unique request key
    getRequestKey(method, url, body = null) {
        return `${method}:${url}:${body ? JSON.stringify(body) : ''}`;
    }

    // Utility: Fetch with retries and timeout
    async fetchWithRetry(url, options, retries = 3, delayMs = 1000) {
        let lastError;
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
                const response = await fetch(url, { ...options, signal: controller.signal });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error(`${response.status}: ${response.statusText}`);
                }
                return response;
            } catch (error) {
                lastError = error;
                if (error.name === 'AbortError' || attempt === retries - 1) {
                    throw error;
                }
                const backoff = delayMs * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, backoff));
            }
        }
        throw lastError;
    }

    // Core request handler
    async makeRequest(method, url, body = null, signal = null) {
        const requestKey = this.getRequestKey(method, url, body);

        if (this.currentRequest && this.currentRequest.key === requestKey) {
            return this.currentRequest.promise;
        }

        if (this.currentRequest) {
            this.currentRequest.controller.abort();
        }

        const controller = new AbortController();
        const options = {
            method,
            signal: signal || controller.signal,
            ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        };

        const promise = this.fetchWithRetry(url, options)
            .then(response => response.status === 204 ? null : response.json())
            .then(result => {
                if (!result) return { status: 'success', data: null };
                if (result.status !== 'success') throw new Error(result.message || 'Request failed');
                return { status: 'success', data: result.data, ...(result.meta && { meta: result.meta }) };
            })
            .catch(error => {
                const errorResult = { status: 'error', data: null };
                if (error.name !== 'AbortError') {
                    this.onError(`${error.message} (${method} ${url})`);
                }
                return errorResult;
            })
            .finally(() => {
                if (this.currentRequest && this.currentRequest.key === requestKey) {
                    this.currentRequest = null;
                }
            });

        this.currentRequest = { key: requestKey, promise, controller };
        return promise;
    }

    // Public API methods
    async getContacts(pageCount = 10, page = 1, query = '', descOrder = false, signal) {
        const url = `${this.baseUrl}/contacts?pageCount=${pageCount}&page=${page}&query=${encodeURIComponent(query)}&descOrder=${descOrder}`;
        return this.makeRequest('GET', url, null, signal);
    }

    async getContact(id, signal) {
        const url = `${this.baseUrl}/contacts/${id}`;
        return this.makeRequest('GET', url, null, signal);
    }

    async upsertContact(contact, signal) {
        if (!contact?.firstName || !contact?.lastName) {
            this.onError('First and last name are required');
            return { status: 'error', data: null };
        }
        const isNew = contact.id === 0;
        const url = isNew ? `${this.baseUrl}/contacts` : `${this.baseUrl}/contacts/${contact.id}`;
        const method = isNew ? 'POST' : 'PUT';
        return this.makeRequest(method, url, contact, signal);
    }

    async deleteContact(id, signal) {
        const url = `${this.baseUrl}/contacts/${id}`;
        return this.makeRequest('DELETE', url, null, signal);
    }
}

export default ContactService;
