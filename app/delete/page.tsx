"use client";

import { useState, useCallback, useEffect } from "react";
import { ApiConfig } from "@/components/api-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Search, Trash2, CheckSquare, Square, RefreshCw } from "lucide-react";
import {
    listAllContacts,
    deleteContact,
    type ChatwootContact,
} from "@/lib/chatwoot";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function DeletePage() {
    const [apiUrl, setApiUrl] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [accountId, setAccountId] = useState<number | null>(null);

    const [contacts, setContacts] = useState<ChatwootContact[]>([]);
    const [filteredContacts, setFilteredContacts] = useState<ChatwootContact[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteProgress, setDeleteProgress] = useState(0);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDeleting) {
                e.preventDefault();
                e.returnValue = "";
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDeleting]);

    const handleLoadContacts = useCallback(async () => {
        if (!apiUrl || !apiKey || !accountId) {
            toast.error("Please configure API settings first");
            return;
        }

        setIsLoading(true);
        try {
            const allContacts = await listAllContacts(apiUrl, apiKey, accountId);
            setContacts(allContacts);
            setFilteredContacts(allContacts);
            setSelectedIds(new Set());
            toast.success(`Loaded ${allContacts.length} contacts`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to load contacts");
        } finally {
            setIsLoading(false);
        }
    }, [apiUrl, apiKey, accountId]);

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        const lowerQuery = query.toLowerCase();
        setFilteredContacts(
            contacts.filter(c =>
                (c.name && c.name.toLowerCase().includes(lowerQuery)) ||
                (c.email && c.email.toLowerCase().includes(lowerQuery)) ||
                (c.phone_number && c.phone_number.toLowerCase().includes(lowerQuery)) ||
                (c.labels && c.labels.some(l => l.toLowerCase().includes(lowerQuery)))
            )
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredContacts.length) {
            // Deselect all
            setSelectedIds(new Set());
        } else {
            // Select all visible
            setSelectedIds(new Set(filteredContacts.map(c => c.id as number)));
        }
    };

    const toggleSelect = (id: number) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const handleDelete = async () => {
        if (!apiUrl || !apiKey || !accountId) return;
        if (selectedIds.size === 0) return;

        const confirmDelete = confirm(`Are you sure you want to delete ${selectedIds.size} contacts? This cannot be undone.`);
        if (!confirmDelete) return;

        setIsDeleting(true);
        setDeleteProgress(0);

        const idsToDelete = Array.from(selectedIds);
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < idsToDelete.length; i++) {
            const id = idsToDelete[i];
            try {
                await deleteContact(apiUrl, apiKey, accountId, id);
                successCount++;
            } catch (err) {
                console.error(`Failed to delete ${id}`, err);
                failCount++;
            }
            setDeleteProgress(((i + 1) / idsToDelete.length) * 100);
        }

        toast.success(`Deleted ${successCount} contacts${failCount > 0 ? ` (${failCount} failed)` : ''}`);

        setIsDeleting(false);
        // Reload contacts after deletion
        handleLoadContacts();
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Mass Delete Contacts</h2>
                <p className="text-muted-foreground">Select and delete multiple contacts from Chatwoot</p>
            </div>

            <ApiConfig
                apiUrl={apiUrl}
                apiKey={apiKey}
                onApiUrlChange={setApiUrl}
                onApiKeyChange={setApiKey}
                onAccountId={setAccountId}
            />

            {accountId && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div>
                            <CardTitle>Manage Contacts</CardTitle>
                            <CardDescription>
                                Load all contacts, filter them, and select which ones to delete
                            </CardDescription>
                        </div>
                        <Button
                            onClick={handleLoadContacts}
                            disabled={isLoading || isDeleting}
                        >
                            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                            {isLoading ? "Loading..." : "Load Contacts"}
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {contacts.length > 0 && (
                            <>
                                <div className="flex items-center gap-4">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search by name, email, phone, or label..."
                                            className="pl-9"
                                            value={searchQuery}
                                            onChange={(e) => handleSearch(e.target.value)}
                                            disabled={isDeleting}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                                            {selectedIds.size} selected
                                        </span>
                                        <Button
                                            variant="destructive"
                                            disabled={selectedIds.size === 0 || isDeleting}
                                            onClick={handleDelete}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete Selected
                                        </Button>
                                    </div>
                                </div>

                                {isDeleting && (
                                    <div className="space-y-2 py-2 p-4 rounded-md border border-amber-500/30 bg-amber-500/5">
                                        <div className="flex justify-between items-center mb-1">
                                            <Badge variant="outline" className="text-amber-500 border-amber-500/50 bg-amber-500/10">
                                                DON'T CLOSE THE TAB AND BROWSER
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between text-sm text-muted-foreground">
                                            <span>Deleting contacts...</span>
                                            <span>{Math.round(deleteProgress)}%</span>
                                        </div>
                                        <Progress value={deleteProgress} />
                                    </div>
                                )}

                                <div className="rounded-md border border-border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-12 text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={toggleSelectAll}
                                                        disabled={filteredContacts.length === 0 || isDeleting}
                                                    >
                                                        {selectedIds.size > 0 && selectedIds.size === filteredContacts.length ? (
                                                            <CheckSquare className="h-4 w-4" />
                                                        ) : (
                                                            <Square className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Email / Phone</TableHead>
                                                <TableHead>Labels</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredContacts.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                        No contacts found
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredContacts.map((contact) => (
                                                    <TableRow key={contact.id} className={selectedIds.has(contact.id as number) ? "bg-muted/50" : ""}>
                                                        <TableCell className="text-center">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => toggleSelect(contact.id as number)}
                                                                disabled={isDeleting}
                                                            >
                                                                {selectedIds.has(contact.id as number) ? (
                                                                    <CheckSquare className="h-4 w-4 text-primary" />
                                                                ) : (
                                                                    <Square className="h-4 w-4 text-muted-foreground" />
                                                                )}
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell className="font-medium">{contact.name || "Unknown"}</TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                                                {contact.email && <span>{contact.email}</span>}
                                                                {contact.phone_number && <span>{contact.phone_number}</span>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-wrap gap-1">
                                                                {contact.labels?.map((label) => (
                                                                    <Badge key={label} variant="secondary" className="text-xs font-normal">
                                                                        {label}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
