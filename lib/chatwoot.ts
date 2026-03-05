// Client-side Chatwoot API wrapper
// All calls go through /api/proxy to avoid CORS issues

export interface ChatwootContact {
    id?: number;
    name?: string;
    phone_number?: string;
    email?: string;
    labels?: string[];
    [key: string]: unknown;
}

export interface ChatwootLabel {
    id?: number;
    title: string;
    description?: string;
    color?: string;
    show_on_sidebar?: boolean;
}

interface ProfileResponse {
    account_id?: number;
    accounts?: Array<{ id: number; name: string }>;
    [key: string]: unknown;
}

interface ContactsResponse {
    payload: ChatwootContact[];
    meta?: {
        count?: number;
        current_page?: number;
        all_count?: number;
    };
}

// Normalize: if the user passes just the domain, append /api/v1
function apiBase(apiUrl: string): string {
    const url = apiUrl.replace(/\/+$/, "");
    if (url.endsWith("/api/v1")) return url;
    return `${url}/api/v1`;
}

// Route all requests through the local proxy to avoid CORS
async function proxyFetch(
    apiUrl: string,
    apiKey: string,
    path: string,
    method: string = "GET",
    payload?: unknown
): Promise<Response> {
    const url = `${apiBase(apiUrl)}${path}`;

    const res = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, method, apiKey, payload }),
    });

    return res;
}

export async function testConnection(
    apiUrl: string,
    apiKey: string
): Promise<{ success: boolean; accountId?: number; error?: string }> {
    try {
        const profileRes = await proxyFetch(apiUrl, apiKey, "/profile");
        if (!profileRes.ok) {
            return { success: false, error: `HTTP ${profileRes.status}: ${profileRes.statusText}` };
        }
        const data: ProfileResponse = await profileRes.json();
        const accountId = data.account_id || data.accounts?.[0]?.id;
        if (!accountId) {
            return { success: false, error: "Could not find account ID in profile" };
        }
        return { success: true, accountId };
    } catch (err) {
        return { success: false, error: String(err) };
    }
}

export async function getAccountId(
    apiUrl: string,
    apiKey: string
): Promise<number> {
    const res = await proxyFetch(apiUrl, apiKey, "/profile");
    if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
    const data: ProfileResponse = await res.json();
    const accountId = data.account_id || data.accounts?.[0]?.id;
    if (!accountId) throw new Error("Could not determine account ID");
    return accountId;
}

export async function listLabels(
    apiUrl: string,
    apiKey: string,
    accountId: number
): Promise<ChatwootLabel[]> {
    const res = await proxyFetch(apiUrl, apiKey, `/accounts/${accountId}/labels`);
    if (!res.ok) throw new Error(`Failed to fetch labels: ${res.status}`);
    const data = await res.json();
    return data.payload || data;
}

export async function createLabel(
    apiUrl: string,
    apiKey: string,
    accountId: number,
    title: string,
    description?: string
): Promise<ChatwootLabel> {
    const color = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    const res = await proxyFetch(
        apiUrl, apiKey,
        `/accounts/${accountId}/labels`,
        "POST",
        { title, description: description || "", show_on_sidebar: true, color }
    );
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to create label "${title}": ${res.status} - ${errText}`);
    }
    return res.json();
}

export async function searchContact(
    apiUrl: string,
    apiKey: string,
    accountId: number,
    query: string
): Promise<ChatwootContact | null> {
    const res = await proxyFetch(
        apiUrl, apiKey,
        `/accounts/${accountId}/contacts/search?q=${encodeURIComponent(query)}&include_contacts=true`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const contacts = data.payload || [];
    return contacts.length > 0 ? contacts[0] : null;
}

export async function createContact(
    apiUrl: string,
    apiKey: string,
    accountId: number,
    contact: { name?: string; phone_number?: string; email?: string }
): Promise<ChatwootContact> {
    const res = await proxyFetch(
        apiUrl, apiKey,
        `/accounts/${accountId}/contacts`,
        "POST",
        contact
    );
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to create contact: ${res.status} - ${errText}`);
    }
    const data = await res.json();
    return data.payload?.contact || data;
}

export async function updateContactLabels(
    apiUrl: string,
    apiKey: string,
    accountId: number,
    contactId: number,
    labels: string[]
): Promise<void> {
    const res = await proxyFetch(
        apiUrl, apiKey,
        `/accounts/${accountId}/contacts/${contactId}/labels`,
        "POST",
        { labels }
    );
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to update labels for contact ${contactId}: ${res.status} - ${errText}`);
    }
}

export async function listContacts(
    apiUrl: string,
    apiKey: string,
    accountId: number,
    page: number = 1
): Promise<ContactsResponse> {
    const res = await proxyFetch(
        apiUrl, apiKey,
        `/accounts/${accountId}/contacts?page=${page}`
    );
    if (!res.ok) throw new Error(`Failed to fetch contacts: ${res.status}`);
    return res.json();
}

export async function listAllContacts(
    apiUrl: string,
    apiKey: string,
    accountId: number,
    onProgress?: (loaded: number) => void
): Promise<ChatwootContact[]> {
    const allContacts: ChatwootContact[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const data = await listContacts(apiUrl, apiKey, accountId, page);
        const contacts = data.payload || [];
        allContacts.push(...contacts);
        onProgress?.(allContacts.length);

        if (contacts.length < 15) {
            hasMore = false;
        } else {
            page++;
        }
    }

    return allContacts;
}

export async function deleteContact(
    apiUrl: string,
    apiKey: string,
    accountId: number,
    contactId: number
): Promise<void> {
    const res = await proxyFetch(
        apiUrl, apiKey,
        `/accounts/${accountId}/contacts/${contactId}`,
        "DELETE"
    );
    if (!res.ok) {
        let errText = await res.text().catch(() => "Unknown error");
        throw new Error(`Failed to delete contact ${contactId}: ${res.status} - ${errText}`);
    }
}
