import { IconPlus, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminUser, ListUsersQuery } from "@/lib/admin-types";
import {
  formatDate,
  formatRelativeTime,
  getUserStatus,
} from "@/lib/admin-utils";
import { authClient } from "@/lib/auth-client";
import { UserActions } from "./user-actions";

type UserListProps = {
  onEditUser?: (user: AdminUser) => void;
  onCreateUser?: () => void;
};

export function UserList({ onEditUser, onCreateUser }: UserListProps) {
  const [query, setQuery] = useState<ListUsersQuery>({
    limit: 50,
    offset: 0,
    sortBy: "createdAt",
    sortDirection: "desc",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "users", query],
    queryFn: async () => {
      const response = await authClient.admin.listUsers({ query });
      if (!response.data) {
        throw new Error("Failed to fetch users");
      }
      return response.data;
    },
  });

  const handleSearch = () => {
    setQuery((prev) => ({
      ...prev,
      searchValue: searchTerm || undefined,
      searchField: "email",
      searchOperator: "contains",
      offset: 0, // Reset to first page
    }));
  };

  const handleFilterChange = (status: string) => {
    setFilterStatus(status);
    setQuery((prev) => ({
      ...prev,
      filterField: status === "all" ? undefined : "banned",
      filterValue: status === "all" ? undefined : status === "banned",
      filterOperator: status === "all" ? undefined : "eq",
      offset: 0,
    }));
  };

  const handleSortChange = (sortBy: string) => {
    setQuery((prev) => ({
      ...prev,
      sortBy,
      sortDirection:
        prev.sortBy === sortBy && prev.sortDirection === "asc" ? "desc" : "asc",
    }));
  };

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 text-center">
            <p className="text-muted-foreground text-sm">
              Failed to load users. Please try again.
            </p>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row">
            <div className="flex flex-1 gap-2">
              <Input
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search users by email..."
                value={searchTerm}
              />
              <Button onClick={handleSearch} variant="outline">
                <IconSearch className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Select onValueChange={handleFilterChange} value={filterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="banned">Banned</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                </SelectContent>
              </Select>
              <Button className="whitespace-nowrap" onClick={onCreateUser}>
                <IconPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </div>
          </div>

          {/* Users Table */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div className="h-16 animate-pulse rounded bg-muted" key={i} />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSortChange("email")}
                  >
                    Email
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSortChange("name")}
                  >
                    Name
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSortChange("createdAt")}
                  >
                    Created
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.users?.map((user) => {
                  const status = getUserStatus(user);
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.email}
                      </TableCell>
                      <TableCell>{user.name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role || "user"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">
                            {formatDate(user.createdAt)}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {formatRelativeTime(user.createdAt)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <UserActions
                          onEdit={() => onEditUser?.(user)}
                          onRefresh={() => refetch()}
                          user={user}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination Info */}
          {data && (
            <div className="mt-4 text-muted-foreground text-sm">
              Showing {Math.min(Number(query.offset || 0) + 1, data.total)} -{" "}
              {Math.min(
                Number(query.offset || 0) + Number(query.limit || 50),
                data.total
              )}{" "}
              of {data.total} users
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
