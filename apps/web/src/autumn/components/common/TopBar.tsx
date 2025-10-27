import { HelpCircle, History, LogOut, Menu, UserCog } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

type TopBarProps = {
    onHelp: () => void;
    onOpenHistory: () => void;
    onOpenRoleModal?: () => void;
    onReleaseSeat?: () => void;
    identityName?: string;
    identityLabel?: string;
    connectionHint?: string;
};

export function TopBar({
    onHelp,
    onOpenHistory,
    onOpenRoleModal,
    onReleaseSeat,
    identityLabel,
    identityName,
    connectionHint,
}: TopBarProps) {
    return (
        <div className="flex w-full items-center justify-between p-4 md:p-6">
            <div className="flex flex-col text-[#4a2a16]">
                <h1 className="text-lg font-semibold">🍂 Herbstwürfel</h1>
                {(identityLabel || connectionHint) && (
                    <span className="text-xs text-[#4a2a16b3]">
                        {identityLabel && identityName ? `${identityLabel} · ${identityName}` : identityLabel ?? connectionHint}
                    </span>
                )}
                {connectionHint && identityLabel && identityName && (
                    <span className="text-xs text-[#4a2a1680]">{connectionHint}</span>
                )}
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger
                    data-slot="menu-trigger"
                    className="rounded-full border p-2 transition-colors"
                >
                    <Menu className="h-5 w-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent data-slot="menu-content" className="border rounded-xl text-sm">
                    <DropdownMenuItem
                        data-slot="menu-item"
                        onClick={onHelp}
                        className="cursor-pointer gap-2 px-3 py-2"
                    >
                        <HelpCircle className="h-4 w-4" />
                        Hilfe
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        data-slot="menu-item"
                        onClick={onOpenHistory}
                        className="cursor-pointer gap-2 px-3 py-2"
                    >
                        <History className="h-4 w-4" />
                        Verlauf
                    </DropdownMenuItem>
                    {(onOpenRoleModal || onReleaseSeat) && <DropdownMenuSeparator data-slot="menu-separator" />}
                    {onOpenRoleModal && (
                        <DropdownMenuItem
                            data-slot="menu-item"
                            onClick={onOpenRoleModal}
                            className="cursor-pointer gap-2 px-3 py-2"
                        >
                            <UserCog className="h-4 w-4" />
                            Sitz verwalten
                        </DropdownMenuItem>
                    )}
                    {onReleaseSeat && (
                        <DropdownMenuItem
                            data-slot="menu-item"
                            onClick={onReleaseSeat}
                            className="cursor-pointer gap-2 px-3 py-2"
                        >
                            <LogOut className="h-4 w-4" />
                            Abmelden
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
