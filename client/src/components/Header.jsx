import React from "react";
import { FaBars } from "react-icons/fa";
import UserMenu from "./DropdownProfile";
import Help from "./DropdownHelp";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

function Header({ sidebarOpen, setSidebarOpen, profile }) {
  return (
    <header className="sticky top-0 z-30 flex w-full items-center gap-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Open navigation"
      >
        <FaBars />
      </button>

      <WorkspaceSwitcher />

      <div className="ml-auto flex items-center gap-2">
        {profile?.name && <span className="hidden text-sm font-medium text-slate-500 xl:inline">{profile.name}</span>}
        <Help align="right" />
        <UserMenu align="right" />
      </div>
    </header>
  );
}

export default Header;
