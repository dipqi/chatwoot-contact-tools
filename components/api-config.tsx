"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { testConnection } from "@/lib/chatwoot";
import { CheckCircle2, XCircle, Loader2, Plug } from "lucide-react";

interface ApiConfigProps {
    apiUrl: string;
    apiKey: string;
    onApiUrlChange: (url: string) => void;
    onApiKeyChange: (key: string) => void;
    onAccountId: (id: number) => void;
}

export function ApiConfig({
    apiUrl,
    apiKey,
    onApiUrlChange,
    onApiKeyChange,
    onAccountId,
}: ApiConfigProps) {
    const [testing, setTesting] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [statusMessage, setStatusMessage] = useState("");
    const [remember, setRemember] = useState(false);

    // Load from local storage on mount
    useEffect(() => {
        const savedUrl = localStorage.getItem("chatwoot_api_url");
        const savedKey = localStorage.getItem("chatwoot_api_key");
        const savedRemember = localStorage.getItem("chatwoot_remember") === "true";

        if (savedRemember) {
            setRemember(true);
            if (savedUrl) onApiUrlChange(savedUrl);
            if (savedKey) onApiKeyChange(savedKey);
        }
    }, [onApiUrlChange, onApiKeyChange]);

    // Handle remember changes
    useEffect(() => {
        if (remember) {
            localStorage.setItem("chatwoot_remember", "true");
            if (apiUrl) localStorage.setItem("chatwoot_api_url", apiUrl);
            if (apiKey) localStorage.setItem("chatwoot_api_key", apiKey);
        } else {
            localStorage.removeItem("chatwoot_remember");
            localStorage.removeItem("chatwoot_api_url");
            localStorage.removeItem("chatwoot_api_key");
        }
    }, [remember, apiUrl, apiKey]);

    const handleTest = async () => {
        if (!apiUrl || !apiKey) {
            setStatus("error");
            setStatusMessage("Please fill in both fields");
            return;
        }

        setTesting(true);
        setStatus("idle");

        const baseUrl = apiUrl.replace(/\/+$/, "").replace(/\/api\/v1\/?$/, "");
        onApiUrlChange(baseUrl);

        if (remember) {
            localStorage.setItem("chatwoot_api_url", baseUrl);
            localStorage.setItem("chatwoot_api_key", apiKey);
        }

        const result = await testConnection(baseUrl, apiKey);

        if (result.success && result.accountId) {
            setStatus("success");
            setStatusMessage(`Connected · Account #${result.accountId}`);
            onAccountId(result.accountId);
        } else {
            setStatus("error");
            setStatusMessage(result.error || "Connection failed");
        }

        setTesting(false);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Plug className="h-4 w-4" />
                    API Configuration
                </CardTitle>
                <CardDescription>
                    Connect to your Chatwoot instance
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="api-url">API Base URL</Label>
                        <Input
                            id="api-url"
                            placeholder="https://app.chatwoot.com"
                            value={apiUrl}
                            onChange={(e) => onApiUrlChange(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="api-key">API Access Token</Label>
                        <Input
                            id="api-key"
                            type="password"
                            placeholder="Your access token"
                            value={apiKey}
                            onChange={(e) => onApiKeyChange(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleTest}
                            disabled={testing}
                        >
                            {testing && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                            Test Connection
                        </Button>

                        {status === "success" && (
                            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                                <CheckCircle2 className="h-4 w-4" />
                                {statusMessage}
                            </span>
                        )}
                        {status === "error" && (
                            <span className="flex items-center gap-1.5 text-sm text-destructive">
                                <XCircle className="h-4 w-4" />
                                {statusMessage}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="remember"
                            checked={remember}
                            onCheckedChange={(checked) => setRemember(checked as boolean)}
                        />
                        <Label htmlFor="remember" className="text-sm cursor-pointer">Remember credentials</Label>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
