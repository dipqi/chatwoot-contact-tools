import { NextRequest, NextResponse } from "next/server";

// Local proxy to bypass CORS when calling Chatwoot API from the browser.
// Browser → localhost:3000/api/proxy → Chatwoot instance
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url, method = "GET", apiKey, payload } = body as {
            url: string;
            method?: string;
            apiKey: string;
            payload?: unknown;
        };

        if (!url || !apiKey) {
            return NextResponse.json(
                { error: "Missing url or apiKey" },
                { status: 400 }
            );
        }

        const fetchOptions: RequestInit = {
            method,
            headers: {
                "Content-Type": "application/json",
                api_access_token: apiKey,
            },
        };

        if (payload && method !== "GET") {
            fetchOptions.body = JSON.stringify(payload);
        }

        const response = await fetch(url, fetchOptions);
        const text = await response.text();
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json") && text) {
            try {
                return NextResponse.json(JSON.parse(text), { status: response.status });
            } catch {
                return new NextResponse(text, { status: response.status, headers: { "Content-Type": contentType } });
            }
        } else {
            return new NextResponse(text, { status: response.status, headers: { "Content-Type": contentType } });
        }
    } catch (err) {
        console.error("[PROXY FATAL ERROR]", err);
        return NextResponse.json(
            { error: String(err) },
            { status: 500 }
        );
    }
}
