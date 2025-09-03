import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useOrganizations, useActiveOrganization, useSetActiveOrganization } from "@/hooks/use-organizations";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Plus, Settings, Building2 } from "lucide-react";
import { useState } from "react";
import { CreateOrganizationDialog } from "./create-organization-dialog";
import type { Organization } from "@/lib/organization-types";

interface OrganizationSwitcherProps {
  className?: string;
  onCreateOrganization?: () => void;
  onManageOrganizations?: () => void;
}

export function OrganizationSwitcher({ 
  className,
  onCreateOrganization,
  onManageOrganizations
}: OrganizationSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  const { data: organizations = [], isLoading: isLoadingOrganizations } = useOrganizations();
  const { data: activeOrganization, isLoading: isLoadingActive } = useActiveOrganization();
  const setActiveOrganization = useSetActiveOrganization();

  const handleSelectOrganization = (organization: Organization) => {
    if (organization.id !== activeOrganization?.id) {
      setActiveOrganization.mutate(organization.id);
    }
    setOpen(false);
  };

  const handleCreateClick = () => {
    setOpen(false);
    if (onCreateOrganization) {
      onCreateOrganization();
    } else {
      setShowCreateDialog(true);
    }
  };

  const handleManageClick = () => {
    setOpen(false);
    if (onManageOrganizations) {
      onManageOrganizations();
    }
  };

  if (isLoadingOrganizations || isLoadingActive) {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <div className="h-8 w-8 animate-pulse bg-muted rounded" />
        <div className="h-4 w-32 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  if (!organizations.length) {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <Button
          variant="outline"
          onClick={handleCreateClick}
          className="justify-start"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Organization
        </Button>
        <CreateOrganizationDialog 
          open={showCreateDialog} 
          onOpenChange={setShowCreateDialog}
        />
      </div>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select organization"
            className={cn("w-[200px] justify-between", className)}
          >
            <div className="flex items-center space-x-2">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-muted">
                <Building2 className="h-3 w-3" />
              </div>
              <span className="truncate">
                {activeOrganization?.name || "Select organization"}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search organizations..." />
            <CommandList>
              <CommandEmpty>No organizations found.</CommandEmpty>
              <CommandGroup heading="Organizations">
                {organizations.map((organization) => (
                  <CommandItem
                    key={organization.id}
                    onSelect={() => handleSelectOrganization(organization)}
                    className="text-sm"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded bg-muted">
                        {organization.logo ? (
                          <img
                            src={organization.logo}
                            alt={organization.name}
                            className="h-5 w-5 rounded"
                          />
                        ) : (
                          <Building2 className="h-3 w-3" />
                        )}
                      </div>
                      <span className="truncate">{organization.name}</span>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        activeOrganization?.id === organization.id
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem onSelect={handleCreateClick}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Organization
                </CommandItem>
                {onManageOrganizations && (
                  <CommandItem onSelect={handleManageClick}>
                    <Settings className="mr-2 h-4 w-4" />
                    Manage Organizations
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      <CreateOrganizationDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
      />
    </>
  );
}