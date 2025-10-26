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
                <h1 className="text-lg font-semibold">🍂 Autumn Dice</h1>
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
                <DropdownMenuTrigger className="rounded-full border border-[#e2c9a0] bg-[#fdf0d6] p-2 text-[#4a2a16] shadow-[0_10px_24px_rgba(146,84,36,0.24)] transition-colors hover:bg-[#fbe2ba]">
                    <Menu className="h-5 w-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="border border-[#e2c9a0] bg-[#fdf7ea] text-[#4a2a16] shadow-[0_16px_36px_rgba(146,84,36,0.18)]">
                    <DropdownMenuItem onClick={onHelp} className="cursor-pointer gap-2 hover:bg-[#f9ddb6]">
                        <HelpCircle className="h-4 w-4" />
                        Hilfe
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onOpenHistory} className="cursor-pointer gap-2 hover:bg-[#f9ddb6]">
                        <History className="h-4 w-4" />
                        Verlauf
                    </DropdownMenuItem>
                    {(onOpenRoleModal || onReleaseSeat) && <DropdownMenuSeparator className="bg-[#e8d3ad]" />}
                    {onOpenRoleModal && (
                        <DropdownMenuItem onClick={onOpenRoleModal} className="cursor-pointer gap-2 hover:bg-[#f9ddb6]">
                            <UserCog className="h-4 w-4" />
                            Sitz verwalten
                        </DropdownMenuItem>
                    )}
                    {onReleaseSeat && (
                        <DropdownMenuItem onClick={onReleaseSeat} className="cursor-pointer gap-2 hover:bg-[#f9ddb6]">
                            <LogOut className="h-4 w-4" />
                            Abmelden
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
