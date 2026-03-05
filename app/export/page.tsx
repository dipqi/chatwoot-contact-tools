"use client";

import { useState, useCallback, useEffect } from "react";
import Papa from "papaparse";
import { ApiConfig } from "@/components/api-config";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    Download,
    Loader2,
    Tag,
    Users,
    RefreshCw,
    Search,
} from "lucide-react";
import {
    getAccountId,
    listLabels,
    listAllContacts,
    ChatwootLabel,
    ChatwootContact,
} from "@/lib/chatwoot";

export default function ExportPage() {
    const [apiUrl, setApiUrl] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [accountId, setAccountId] = useState<number | null>(null);

    // Labels state
    const [labels, setLabels] = useState<ChatwootLabel[]>([]);
    const [loadingLabels, setLoadingLabels] = useState(false);
    const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());

    // Contacts state
    const [contacts, setContacts] = useState<ChatwootContact[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [contactsLoaded, setContactsLoaded] = useState(0);
    const [contactSearch, setContactSearch] = useState("");

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (loadingContacts) {
                e.preventDefault();
                e.returnValue = "";
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [loadingContacts]);

    const ensureAccountId = useCallback(async () => {
        if (accountId) return accountId;
        if (!apiUrl || !apiKey) {
            toast.error("Please configure API connection first");
            return null;
        }
        try {
            const id = await getAccountId(apiUrl, apiKey);
            setAccountId(id);
            return id;
        } catch {
            toast.error("Failed to get account ID. Test your connection first.");
            return null;
        }
    }, [accountId, apiUrl, apiKey]);

    // Labels
    const fetchLabels = async () => {
        const accId = await ensureAccountId();
        if (!accId) return;
        setLoadingLabels(true);
        try {
            const data = await listLabels(apiUrl, apiKey, accId);
            setLabels(data);
            toast.success(`Loaded ${data.length} labels`);
        } catch (err) {
            toast.error(`Failed to fetch labels: ${err}`);
        } finally {
            setLoadingLabels(false);
        }
    };

    const toggleLabel = (title: string) => {
        setSelectedLabels((prev) => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            return next;
        });
    };

    const toggleAllLabels = () => {
        if (selectedLabels.size === labels.length) {
            setSelectedLabels(new Set());
        } else {
            setSelectedLabels(new Set(labels.map((l) => l.title)));
        }
    };

    const exportLabels = () => {
        const data = labels
            .filter((l) => selectedLabels.has(l.title))
            .map((l) => ({
                title: l.title,
                description: l.description || "",
                show_on_sidebar: l.show_on_sidebar ? "yes" : "no",
            }));

        if (data.length === 0) {
            toast.error("No labels selected");
            return;
        }

        const csv = Papa.unparse(data);
        downloadCsv(csv, "chatwoot-labels.csv");
        toast.success(`Exported ${data.length} labels`);
    };

    // Contacts
    const fetchContacts = async () => {
        const accId = await ensureAccountId();
        if (!accId) return;
        setLoadingContacts(true);
        setContactsLoaded(0);
        try {
            const data = await listAllContacts(apiUrl, apiKey, accId, (loaded) => {
                setContactsLoaded(loaded);
            });
            setContacts(data);
            toast.success(`Loaded ${data.length} contacts`);
        } catch (err) {
            toast.error(`Failed to fetch contacts: ${err}`);
        } finally {
            setLoadingContacts(false);
        }
    };

    const filteredContacts = contacts.filter((c) => {
        if (!contactSearch) return true;
        const q = contactSearch.toLowerCase();
        return (
            c.name?.toLowerCase().includes(q) ||
            c.phone_number?.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q)
        );
    });

    const exportContacts = () => {
        const data = filteredContacts.map((c) => ({
            id: c.id || "",
            name: c.name || "",
            phone_number: c.phone_number || "",
            email: c.email || "",
            labels: (c.labels || []).join(", "),
        }));

        if (data.length === 0) {
            toast.error("No contacts to export");
            return;
        }

        const csv = Papa.unparse(data);
        downloadCsv(csv, "chatwoot-contacts.csv");
        toast.success(`Exported ${data.length} contacts`);
    };

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Export</h2>
                <p className="text-sm text-muted-foreground">
                    Fetch labels and contacts from Chatwoot, then export as CSV
                </p>
            </div>

            <ApiConfig
                apiUrl={apiUrl}
                apiKey={apiKey}
                onApiUrlChange={setApiUrl}
                onApiKeyChange={setApiKey}
                onAccountId={setAccountId}
            />

            <Tabs defaultValue="labels">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="labels" className="gap-2">
                        <Tag className="h-3.5 w-3.5" />
                        Labels
                    </TabsTrigger>
                    <TabsTrigger value="contacts" className="gap-2">
                        <Users className="h-3.5 w-3.5" />
                        Contacts
                    </TabsTrigger>
                </TabsList>

                {/* Labels Tab */}
                <TabsContent value="labels">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Labels</CardTitle>
                                    <CardDescription>
                                        {labels.length > 0
                                            ? `${labels.length} labels loaded · ${selectedLabels.size} selected`
                                            : "Fetch labels from your Chatwoot instance"}
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={fetchLabels}
                                        disabled={loadingLabels}
                                    >
                                        {loadingLabels ? (
                                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                        ) : (
                                            <RefreshCw className="mr-2 h-3 w-3" />
                                        )}
                                        Fetch
                                    </Button>
                                    {labels.length > 0 && (
                                        <Button size="sm" onClick={exportLabels}>
                                            <Download className="mr-2 h-3 w-3" />
                                            Export CSV
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        {labels.length > 0 && (
                            <CardContent>
                                <div className="max-h-96 overflow-auto rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-12">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedLabels.size === labels.length}
                                                        onChange={toggleAllLabels}
                                                        className="rounded"
                                                    />
                                                </TableHead>
                                                <TableHead>Title</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead className="w-24">Sidebar</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {labels.map((label) => (
                                                <TableRow key={label.title}>
                                                    <TableCell>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedLabels.has(label.title)}
                                                            onChange={() => toggleLabel(label.title)}
                                                            className="rounded"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        <Badge variant="secondary">{label.title}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {label.description || "—"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {label.show_on_sidebar ? (
                                                            <Badge className="bg-emerald-500/10 text-emerald-400">Yes</Badge>
                                                        ) : (
                                                            <Badge variant="outline">No</Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        )}
                    </Card>
                </TabsContent>

                {/* Contacts Tab */}
                <TabsContent value="contacts">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Contacts</CardTitle>
                                    <CardDescription className="flex flex-col gap-2">
                                        <span>
                                            {contacts.length > 0
                                                ? `${contacts.length} contacts loaded`
                                                : loadingContacts
                                                    ? `Loading contacts... (${contactsLoaded} so far)`
                                                    : "Fetch all contacts from your Chatwoot instance"}
                                        </span>
                                        {loadingContacts && (
                                            <Badge variant="outline" className="w-fit text-amber-500 border-amber-500/50 bg-amber-500/10">
                                                DON'T CLOSE THE TAB AND BROWSER
                                            </Badge>
                                        )}
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={fetchContacts}
                                        disabled={loadingContacts}
                                    >
                                        {loadingContacts ? (
                                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                        ) : (
                                            <RefreshCw className="mr-2 h-3 w-3" />
                                        )}
                                        Fetch All
                                    </Button>
                                    {contacts.length > 0 && (
                                        <Button size="sm" onClick={exportContacts}>
                                            <Download className="mr-2 h-3 w-3" />
                                            Export CSV
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        {contacts.length > 0 && (
                            <CardContent className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by name, phone, or email..."
                                        value={contactSearch}
                                        onChange={(e) => setContactSearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Showing {filteredContacts.length} of {contacts.length} contacts
                                </p>
                                <div className="max-h-96 overflow-auto rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-16">ID</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Phone</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Labels</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredContacts.slice(0, 100).map((contact) => (
                                                <TableRow key={contact.id}>
                                                    <TableCell className="text-muted-foreground">
                                                        {contact.id}
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {contact.name || "—"}
                                                    </TableCell>
                                                    <TableCell>{contact.phone_number || "—"}</TableCell>
                                                    <TableCell>{contact.email || "—"}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {(contact.labels || []).map((l) => (
                                                                <Badge key={l} variant="secondary" className="text-xs">
                                                                    {l}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {filteredContacts.length > 100 && (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={5}
                                                        className="text-center text-muted-foreground"
                                                    >
                                                        Showing first 100 of {filteredContacts.length} contacts.
                                                        Use export to get all.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        )}
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function downloadCsv(csvContent: string, filename: string) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
