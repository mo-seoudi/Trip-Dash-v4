// Header.jsx
import React, { useState } from 'react';
import { FaBars, FaBell } from "react-icons/fa";
import UserMenu from './DropdownProfile';
import ThemeToggle from './ThemeToggle';
import Notifications from './DropdownNotifications';
import Help from './DropdownHelp';

function Header({ sidebarOpen, setSidebarOpen, profile }) {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white shadow-md w-full transition-shadow duration-300">
      <button className="lg:hidden text-xl" onClick={() => setSidebarOpen(!sidebarOpen)}>
        <FaBars />
      </button>

      <div className="flex items-center gap-3 ml-auto">
        <span className="text-sm">Hello, {profile?.name}</span>
        <button onClick={() => setShowNotifications(!showNotifications)} className="relative">
          <FaBell />
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-md text-sm z-20 p-2">
              <p>No new notifications</p>
            </div>
          )}
        </button>
        <Notifications align="right" />
        <Help align="right" />
        <ThemeToggle />
        <UserMenu align="right" />
      </div>
    </header>
  );
}

export default Header;
