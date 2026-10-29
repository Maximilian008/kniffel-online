import { Menu, HelpCircle, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface TopBarProps {
  onHelp: () => void;
  onLogout: () => void;
}

export function TopBar({ onHelp, onLogout }: TopBarProps) {
  return (
    <div className="w-full flex justify-between items-center p-4 md:p-6">
      <h1 className="text-amber-200 drop-shadow-[0_2px_8px_rgba(245,169,98,0.5)]">
        🍂 Autumn Dice
      </h1>
      
      <DropdownMenu>
        <DropdownMenuTrigger className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/20">
          <Menu className="w-5 h-5 text-amber-200" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#3d2549] border border-white/20 text-amber-100">
          <DropdownMenuItem onClick={onHelp} className="cursor-pointer hover:bg-white/10">
            <HelpCircle className="w-4 h-4 mr-2" />
            Help
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onLogout} className="cursor-pointer hover:bg-white/10">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
